import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import { createRoutes } from '../server/routes';
import { configFromEnv } from '../server/config';

// A Vercel deployment without Supabase, unlocked by APP_ACCESS_CODE.
const env = { VERCEL: '1', APP_ACCESS_CODE: ' "demo-2026" ', COMPDF_API_KEY: 'ck', AI_DAILY_LIMIT: '2' };

const compdfCalls: string[] = [];
const fakeFetch = (async (input: any) => {
  const url = String(input);
  compdfCalls.push(url);
  if (url.includes('/processAsync/')) return new Response(JSON.stringify({ code: '200', data: { taskId: 'task-12345678' } }));
  return new Response(JSON.stringify({ error: 'unexpected ' + url }), { status: 500 });
}) as typeof fetch;

const call = async (routes: any, path: string, code?: string, body?: unknown) => {
  const req: any = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = body === undefined ? 'GET' : 'POST'; req.url = path; req.headers = code ? { 'x-access-code': code } : {};
  let status = 0; let out = '';
  const res: any = { headersSent: false, statusCode: 200, setHeader() {}, write(c: string) { out += c; }, end(c?: string) { if (c) out += c; status = this.statusCode; } };
  await routes[path](req, res);
  return { status, body: JSON.parse(out) };
};
const pdf = { fileName: 'po.pdf', contentType: 'application/pdf', dataBase64: Buffer.from('%PDF').toString('base64') };

describe('access code mode', () => {
  it('asks for the code, rejects a wrong one, and lets the right one through', async () => {
    const routes = createRoutes(configFromEnv(env), fakeFetch);
    expect(await call(routes, '/api/documents/parse', undefined, pdf)).toEqual({ status: 401, body: { error: 'access_code_required' } });
    expect(await call(routes, '/api/documents/parse', 'nope', pdf)).toEqual({ status: 401, body: { error: 'access_code_invalid' } });
    expect(compdfCalls).toHaveLength(0);
    const ok = await call(routes, '/api/documents/parse', 'demo-2026', pdf);
    expect(ok.status).toBe(200);
    expect(ok.body.task).toMatch(/^task-12345678\./);
  });

  it('caps daily use, and leaves Gmail off (it needs real accounts)', async () => {
    const routes = createRoutes(configFromEnv(env), fakeFetch);
    expect((await call(routes, '/api/documents/parse', 'demo-2026', pdf)).status).toBe(200);
    expect((await call(routes, '/api/documents/parse', 'demo-2026', pdf)).status).toBe(200);
    expect((await call(routes, '/api/documents/parse', 'demo-2026', pdf)).body.error).toBe('quota_exceeded');
    expect((await call(routes, '/api/google/connect', 'demo-2026')).body).toEqual({ available: false, connected: false, email: null });
  });

  it('still refuses everything when neither Supabase nor a code is configured', async () => {
    const routes = createRoutes(configFromEnv({ VERCEL: '1', COMPDF_API_KEY: 'ck' }), fakeFetch);
    expect((await call(routes, '/api/documents/parse', 'anything', pdf)).body.error).toBe('server_misconfigured');
  });
});
