import type { IncomingMessage, ServerResponse } from 'http';

export type Req = IncomingMessage & { body?: unknown };
export type Res = ServerResponse;
export type Handler = (req: Req, res: Res) => Promise<void>;

const MAX_BODY_BYTES = 200_000;

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** Reads a JSON body. Vercel pre-parses bodies; the Vite dev server does not. */
export const readJson = async <T>(req: Req): Promise<T> => {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return JSON.parse(req.body) as T;
    return req.body as T;
  }
  const raw = await new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, 'bad_request');
  }
};

export const sendJson = (res: Res, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

export const queryParams = (req: Req) => new URL(req.url ?? '/', 'http://localhost').searchParams;

export const bearerToken = (req: Req) => {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

/** Wraps a handler with method checking and uniform error responses. */
export const route = (methods: Record<string, Handler>): Handler => async (req, res) => {
  const handler = methods[req.method ?? 'GET'];
  if (!handler) return sendJson(res, 405, { error: 'method_not_allowed' });
  try {
    await handler(req, res);
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    if (error instanceof HttpError) return sendJson(res, error.status, { error: error.code });
    console.error('[api] unhandled error:', error);
    sendJson(res, 500, { error: 'internal_error' });
  }
};
