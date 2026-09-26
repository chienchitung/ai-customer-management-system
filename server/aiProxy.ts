import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';

// Server-side proxy for Gemini. The API key stays on the server and is never
// shipped to the browser bundle.

export interface AIRequestBody {
  contents: { role: 'user' | 'model'; text: string }[];
  systemInstruction?: string;
  responseSchema?: unknown;
  stream?: boolean;
}

const MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const MAX_BODY_BYTES = 200_000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRateLimit = (error: any) => {
  const msg = String(error?.message || error).toLowerCase();
  return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota');
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

export const createAIHandler = (apiKey: string | undefined) => {
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    if (!ai) return sendJson(res, 500, { error: 'missing_api_key' });

    let body: AIRequestBody;
    try {
      body = JSON.parse(await readBody(req));
      if (!Array.isArray(body.contents) || body.contents.length === 0) throw new Error('invalid');
    } catch {
      return sendJson(res, 400, { error: 'bad_request' });
    }

    const request = {
      model: MODEL,
      contents: body.contents.map(c => ({ role: c.role, parts: [{ text: String(c.text) }] })),
      config: {
        ...(body.systemInstruction ? { systemInstruction: body.systemInstruction } : {}),
        ...(body.responseSchema
          ? { responseMimeType: 'application/json', responseSchema: body.responseSchema as any }
          : {}),
      },
    };

    let backoff = 2000;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (body.stream) {
          const stream = await ai.models.generateContentStream(request);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          for await (const chunk of stream) {
            if (chunk.text) res.write(chunk.text);
          }
          res.end();
          return;
        }
        const response = await ai.models.generateContent(request);
        return sendJson(res, 200, { text: (response.text ?? '').trim() });
      } catch (error) {
        if (res.headersSent) {
          res.end();
          return;
        }
        if (isRateLimit(error) && attempt < MAX_RETRIES - 1) {
          await delay(backoff);
          backoff = backoff * 2 + Math.random() * 1000;
          continue;
        }
        console.error('[aiProxy] Gemini call failed:', error);
        return sendJson(res, isRateLimit(error) ? 429 : 502, { error: isRateLimit(error) ? 'rate_limited' : 'upstream_error' });
      }
    }
  };
};
