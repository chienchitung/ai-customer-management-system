import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { HttpError } from './http.js';
import type { ServerConfig } from './config.js';
import { htmlTablesToMarkdown, textFromResult } from './zip.js';

// ComPDF v2 API: the same endpoints the official ComPDF MCP server (github.com/ComPDFKit/compdf-mcp)
// wraps. We call them directly from the server so the API key never reaches the browser and the
// app runs as a plain Vercel function, without hosting a separate MCP service.

export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024; // keeps the base64 request under Vercel's 4.5 MB body limit
export const MAX_DOCUMENT_PAGES = 15;
export const MAX_DOCUMENT_TEXT = 60_000;

export const DOCUMENT_TYPES: Record<string, { kind: 'pdf' | 'image'; ext: string[] }> = {
  'application/pdf': { kind: 'pdf', ext: ['pdf'] },
  'image/png': { kind: 'image', ext: ['png'] },
  'image/jpeg': { kind: 'image', ext: ['jpg', 'jpeg'] },
  'image/bmp': { kind: 'image', ext: ['bmp'] },
};

export interface ParsedDocument {
  text: string;
  truncated: boolean;
  pages: number | null;
  /** ComPDF task id, kept for support and for the submission write-up. */
  taskId: string | null;
}

interface ComPDFFile {
  downloadUrl?: string;
  status?: string;
  failureCode?: string;
  failureReason?: string;
}

interface ComPDFTaskInfo {
  taskId?: string;
  taskStatus?: string;
  taskFailNum?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  fileInfoDTOList?: ComPDFFile[];
}

const safeName = (name: string) => name.replace(/[^\w.\-\u4e00-\u9fff ]+/g, '_').slice(0, 120) || 'document';

/** One ComPDF API call, with key problems and error envelopes mapped to our error codes. */
const compdfRequest = async <T>(config: ServerConfig, path: string, init: RequestInit, fetchImpl: typeof fetch): Promise<T> => {
  if (!config.compdfApiKey) throw new HttpError(501, 'compdf_not_configured');
  let payload: { code?: string | number; msg?: string; data?: T } = {};
  let status = 0;
  try {
    const res = await fetchImpl(`${config.compdfBaseUrl}${path}`, {
      ...init,
      headers: { 'x-api-key': config.compdfApiKey, Accept: 'application/json' },
    });
    status = res.status;
    // A wrong key comes back as 403 with an empty body, so read text first and parse only if present.
    const raw = await res.text();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch (error) {
    console.error('[compdf] request failed:', path, status, error);
    throw new HttpError(502, status === 401 || status === 403 ? 'compdf_unauthorized' : 'compdf_failed');
  }
  if (status === 401 || status === 403) {
    console.error('[compdf] key rejected:', status, payload.code, payload.msg);
    throw new HttpError(502, 'compdf_unauthorized');
  }
  if (String(payload.code) !== '200' || !payload.data) {
    console.error('[compdf] error response:', path, status, payload.code, payload.msg);
    // 01001 "未知用户类型" is what ComPDF returns when the key is missing or not recognised.
    const keyProblem = String(payload.code) === '01001' || /key|auth|credential|用户|用戶|user/i.test(String(payload.msg));
    throw new HttpError(502, keyProblem ? 'compdf_unauthorized' : 'compdf_failed');
  }
  return payload.data;
};

/**
 * Starts an asynchronous conversion: PDF to Markdown (OCR for scanned pages) or image to text.
 * A 15-page paper takes 30-60 s at ComPDF, too close to a serverless time limit to wait for in
 * one request, so the browser polls checkComPDFTask instead.
 */
export const startComPDFTask = async (
  config: ServerConfig,
  file: { fileName: string; contentType: string; bytes: Buffer },
  fetchImpl: typeof fetch = fetch,
): Promise<string> => {
  const type = DOCUMENT_TYPES[file.contentType];
  if (!type) throw new HttpError(415, 'unsupported_document');
  const form = new FormData();
  form.append('language', '1');
  if (type.kind === 'pdf') {
    form.append('pageRanges', `1-${MAX_DOCUMENT_PAGES}`);
    form.append('enableOcr', '1');
    form.append('ocrRecognitionLang', 'AUTO');
    form.append('ocrOption', 'SCAN_PAGE');
    form.append('isContainImg', '0');
    form.append('isContainAnnot', '0');
    form.append('containPageBackgroundImage', '0');
    form.append('isOutputDocumentPerPage', '0');
  }
  form.append('file', new Blob([new Uint8Array(file.bytes)], { type: file.contentType }), safeName(file.fileName));
  const path = type.kind === 'pdf' ? '/v2/processAsync/pdf/markdown' : '/v2/processAsync/img/txt';
  const data = await compdfRequest<{ taskId?: string }>(config, path, { method: 'POST', body: form }, fetchImpl);
  if (!data.taskId) throw new HttpError(502, 'compdf_failed');
  return data.taskId;
};

/** Text cleanup: ComPDF output arrives as a ZIP of Markdown with styled HTML tables and image tags. */
export const cleanComPDFText = (buf: Buffer) =>
  htmlTablesToMarkdown(textFromResult(buf))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // drop image references; the model only needs the text
    .replace(/<img[^>]*>/gi, '')
    .replace(/<\/?(div|p|span|br)[^>]*>/gi, '\n') // leftover layout HTML around images and page markers
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Returns null while ComPDF is still working, the text once it is done, or throws if the task failed. */
export const checkComPDFTask = async (config: ServerConfig, taskId: string, fetchImpl: typeof fetch = fetch): Promise<ParsedDocument | null> => {
  const info = await compdfRequest<ComPDFTaskInfo>(config, `/v2/task/taskInfo?taskId=${encodeURIComponent(taskId)}&language=1`, { method: 'GET' }, fetchImpl);
  const file = info.fileInfoDTOList?.[0];
  const failed = (info.taskFailNum ?? 0) > 0 || !!info.errorCode || /fail|error/i.test(info.taskStatus ?? '') || !!file?.failureCode || !!file?.failureReason;
  if (failed) {
    console.error('[compdf] task failed:', taskId, info.taskStatus, info.errorCode, info.errorMessage, file?.failureCode, file?.failureReason);
    throw new HttpError(422, 'compdf_unreadable');
  }
  if (info.taskStatus !== 'TaskFinish' || !file?.downloadUrl) return null;

  const download = await fetchImpl(file.downloadUrl).catch(() => null);
  if (!download?.ok) throw new HttpError(502, 'compdf_failed');
  let text: string;
  try {
    text = cleanComPDFText(Buffer.from(await download.arrayBuffer()));
  } catch (error) {
    console.error('[compdf] could not read result:', taskId, error);
    throw new HttpError(502, 'compdf_failed');
  }
  if (!text) throw new HttpError(422, 'compdf_unreadable');
  return {
    text: text.slice(0, MAX_DOCUMENT_TEXT),
    truncated: text.length > MAX_DOCUMENT_TEXT,
    pages: null, // ComPDF reports sizes, not page counts
    taskId,
  };
};

// Every user's tasks run under the same ComPDF key, so a bare task id would let anyone who
// learned it read someone else's document. The browser gets the id signed for its user instead.
const taskSecret = (config: ServerConfig) => createHash('sha256').update(`document-task:${config.compdfApiKey}`).digest();

export const signTask = (config: ServerConfig, userId: string, taskId: string) =>
  `${taskId}.${createHmac('sha256', taskSecret(config)).update(`${userId}:${taskId}`).digest('base64url')}`;

export const verifyTask = (config: ServerConfig, userId: string, token: string): string => {
  const dot = token.lastIndexOf('.');
  const taskId = token.slice(0, dot);
  if (dot < 1 || !/^[\w-]{8,64}$/.test(taskId)) throw new HttpError(400, 'bad_request');
  const expected = Buffer.from(signTask(config, userId, taskId));
  const given = Buffer.from(token);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new HttpError(403, 'forbidden');
  return taskId;
};
