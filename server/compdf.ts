import { HttpError } from './http.js';
import type { ServerConfig } from './config.js';

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

interface ComPDFTask {
  taskId?: string;
  downloadUrl?: string;
  status?: string;
  failureCode?: string;
  failureReason?: string;
  convertSize?: number;
}

const safeName = (name: string) => name.replace(/[^\w.\-一-鿿 ]+/g, '_').slice(0, 120) || 'document';

/**
 * Converts a PDF (to Markdown, with OCR for scanned pages) or an image (to text, via OCR) and
 * returns the text, ready for the language model.
 */
export const parseDocumentWithComPDF = async (
  config: ServerConfig,
  file: { fileName: string; contentType: string; bytes: Buffer },
  fetchImpl: typeof fetch = fetch,
): Promise<ParsedDocument> => {
  if (!config.compdfApiKey) throw new HttpError(501, 'compdf_not_configured');
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

  const path = type.kind === 'pdf' ? '/v2/process/pdf/markdown' : '/v2/process/img/txt';
  let payload: { code?: string | number; msg?: string; data?: ComPDFTask } = {};
  let status = 0;
  try {
    const res = await fetchImpl(`${config.compdfBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'x-api-key': config.compdfApiKey, Accept: 'application/json' },
      body: form,
    });
    status = res.status;
    // A wrong key comes back as 403 with an empty body, so read text first and parse only if present.
    const raw = await res.text();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch (error) {
    console.error('[compdf] request failed:', status, error);
    throw new HttpError(502, status === 401 || status === 403 ? 'compdf_unauthorized' : 'compdf_failed');
  }
  if (status === 401 || status === 403) {
    console.error('[compdf] key rejected:', status, payload.code, payload.msg);
    throw new HttpError(502, 'compdf_unauthorized');
  }
  const task = payload.data;
  if (String(payload.code) !== '200' || !task) {
    console.error('[compdf] error response:', status, payload.code, payload.msg);
    // 01001 "未知用户类型" is what ComPDF returns when the key is missing or not recognised.
    const keyProblem = String(payload.code) === '01001' || /key|auth|credential|用户|用戶|user/i.test(String(payload.msg));
    throw new HttpError(502, keyProblem ? 'compdf_unauthorized' : 'compdf_failed');
  }
  if (task.failureCode || task.failureReason || !task.downloadUrl) {
    console.error('[compdf] task failed:', task.taskId, task.failureCode, task.failureReason, task.status);
    throw new HttpError(422, 'compdf_unreadable');
  }

  const download = await fetchImpl(task.downloadUrl).catch(() => null);
  if (!download?.ok) throw new HttpError(502, 'compdf_failed');
  const raw = (await download.text()).trim();
  if (!raw) throw new HttpError(422, 'compdf_unreadable');
  return {
    text: raw.slice(0, MAX_DOCUMENT_TEXT),
    truncated: raw.length > MAX_DOCUMENT_TEXT,
    pages: typeof task.convertSize === 'number' && task.convertSize > 0 ? task.convertSize : null,
    taskId: task.taskId ?? null,
  };
};
