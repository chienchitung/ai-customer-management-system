import { ApiError, apiJson } from './api';

// Client side of the ComPDF step: the file goes to our server, which calls ComPDF with the
// key it holds and returns the document text.

export const ACCEPTED_DOCUMENTS = '.pdf,.png,.jpg,.jpeg,.bmp,application/pdf,image/png,image/jpeg,image/bmp';
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export interface ParsedDocument {
  text: string;
  truncated: boolean;
  pages: number | null;
  taskId: string | null;
}

const TYPE_BY_EXT: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', bmp: 'image/bmp' };

export const documentContentType = (file: File) =>
  file.type && Object.values(TYPE_BY_EXT).includes(file.type) ? file.type : TYPE_BY_EXT[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? '';

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const POLL_MS = 2500;
const GIVE_UP_MS = 3 * 60 * 1000;

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const id = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

/**
 * Uploads the file, then polls until ComPDF is done. Long documents take 30-60 s, so the work runs
 * as a ComPDF async task and each request stays short. onTick reports elapsed seconds.
 */
export const parseDocument = async (file: File, opts: { signal?: AbortSignal; onTick?: (seconds: number) => void } = {}): Promise<ParsedDocument> => {
  const started = Date.now();
  const { task } = await apiJson<{ task: string }>('/api/documents/parse', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, contentType: documentContentType(file), dataBase64: await toBase64(file) }),
    signal: opts.signal,
  });
  for (;;) {
    await wait(POLL_MS, opts.signal);
    opts.onTick?.(Math.round((Date.now() - started) / 1000));
    const r = await apiJson<{ status: 'processing' } | ({ status: 'done' } & ParsedDocument)>(
      `/api/documents/parse?task=${encodeURIComponent(task)}`, { signal: opts.signal },
    );
    if (r.status === 'done') return r;
    if (Date.now() - started > GIVE_UP_MS) throw new ApiError('compdf_timeout', 504);
  }
};
