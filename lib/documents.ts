import { apiJson } from './api';

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

export const parseDocument = async (file: File): Promise<ParsedDocument> =>
  apiJson<ParsedDocument>('/api/documents/parse', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, contentType: documentContentType(file), dataBase64: await toBase64(file) }),
  });
