import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import { createRoutes } from '../server/routes';
import { configFromEnv } from '../server/config';
import { buildRawEmail } from '../server/google';

// Fake Supabase + Google backends behind a single fetch implementation.
const makeFetch = (state: { tokens: Record<string, any>; quota: number; sent: any[] }) =>
  (async (input: any, init: any = {}) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.endsWith('/auth/v1/user')) {
      const auth = init.headers.Authorization;
      return auth === 'Bearer good' ? json({ id: 'user-1' }) : json({ msg: 'bad' }, 401);
    }
    if (url.includes('/rest/v1/google_tokens')) {
      if (init.method === 'POST') { const b = JSON.parse(init.body); state.tokens[b.owner_id] = b; return json(null, 201); }
      if (init.method === 'DELETE') { delete state.tokens['user-1']; return new Response(null, { status: 204 }); }
      return json(state.tokens['user-1'] ? [state.tokens['user-1']] : []);
    }
    if (url.includes('/rest/v1/rpc/consume_ai_quota')) return json(--state.quota >= 0);
    if (url === 'https://oauth2.googleapis.com/token') {
      const token = new URLSearchParams(init.body).get('refresh_token');
      if (token === 'revoked') return json({ error: 'invalid_grant' }, 400);
      return json({ access_token: 'at', scope: token === 'noscope' ? 'email' : 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send' });
    }
    if (url.includes('/revoke')) return json({});
    if (url.endsWith('/users/me/profile')) return json({ emailAddress: 'rep@gmail.com' });
    if (url.includes('/users/me/messages?')) return json({ messages: [{ id: 'm1' }] });
    if (url.includes('/users/me/messages/m1')) {
      return json({ id: 'm1', threadId: 't1', internalDate: '1727000000000', snippet: 'Hi &amp; thanks', payload: { headers: [
        { name: 'From', value: 'Amy <amy@acme.com>' }, { name: 'Subject', value: 'Quote' }, { name: 'To', value: 'rep@gmail.com' },
      ] } });
    }
    if (url.endsWith('/users/me/messages/send')) { state.sent.push(JSON.parse(init.body)); return json({ id: 's1', threadId: 't9' }); }
    return json({ error: 'unexpected ' + url }, 500);
  }) as typeof fetch;

const env = {
  VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc',
  GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'secret', VERCEL: '1',
};

const call = async (routes: any, path: string, opts: { method?: string; token?: string; body?: unknown; query?: string } = {}) => {
  const req: any = Readable.from(opts.body === undefined ? [] : [Buffer.from(JSON.stringify(opts.body))]);
  req.method = opts.method ?? 'GET';
  req.url = path + (opts.query ?? '');
  req.headers = opts.token ? { authorization: `Bearer ${opts.token}` } : {};
  let status = 0; let out = '';
  const res: any = {
    headersSent: false, statusCode: 200,
    setHeader() {}, write(c: string) { out += c; },
    end(c?: string) { if (c) out += c; status = this.statusCode; },
  };
  await routes[path](req, res);
  return { status, body: out ? JSON.parse(out) : null };
};

const setup = (quota = 5) => {
  const state = { tokens: {} as Record<string, any>, quota, sent: [] as any[] };
  return { state, routes: createRoutes(configFromEnv(env), makeFetch(state)) };
};

describe('auth', () => {
  it('rejects missing or invalid tokens', async () => {
    const { routes } = setup();
    expect((await call(routes, '/api/google/connect')).status).toBe(401);
    expect((await call(routes, '/api/google/connect', { token: 'bad' })).status).toBe(401);
  });

  it('refuses to run in production without Supabase config', async () => {
    const routes = createRoutes(configFromEnv({ VERCEL: '1', GEMINI_API_KEY: 'k' }), makeFetch({ tokens: {}, quota: 1, sent: [] }));
    expect((await call(routes, '/api/ai', { method: 'POST', body: { contents: [{ role: 'user', text: 'hi' }] } })).body.error).toBe('server_misconfigured');
  });
});

describe('ai quota', () => {
  it('returns 429 quota_exceeded once the daily limit is used up', async () => {
    const routes = createRoutes(configFromEnv({ ...env, GEMINI_API_KEY: 'k' }), makeFetch({ tokens: {}, quota: 0, sent: [] }));
    const r = await call(routes, '/api/ai', { method: 'POST', token: 'good', body: { contents: [{ role: 'user', text: 'hi' }] } });
    expect(r).toEqual({ status: 429, body: { error: 'quota_exceeded' } });
  });
});

describe('gmail', () => {
  it('connect -> status -> list -> send -> disconnect', async () => {
    const { routes, state } = setup();
    expect((await call(routes, '/api/google/connect', { token: 'good' })).body).toEqual({ available: true, connected: false, email: null });
    expect((await call(routes, '/api/gmail/messages', { token: 'good', query: '?email=amy@acme.com' })).body.error).toBe('google_not_connected');

    const c = await call(routes, '/api/google/connect', { method: 'POST', token: 'good', body: { refreshToken: 'rt' } });
    expect(c.body).toEqual({ connected: true, email: 'rep@gmail.com' });
    expect(state.tokens['user-1'].refresh_token).toBe('rt');

    const list = await call(routes, '/api/gmail/messages', { token: 'good', query: '?email=amy@acme.com' });
    expect(list.body.messages[0]).toMatchObject({ id: 'm1', subject: 'Quote', direction: 'in', snippet: 'Hi & thanks' });

    const sent = await call(routes, '/api/gmail/send', { method: 'POST', token: 'good', body: { to: 'amy@acme.com', subject: '報價', body: '您好' } });
    expect(sent.body).toEqual({ id: 's1', threadId: 't9' });
    const raw = Buffer.from(state.sent[0].raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    expect(raw).toContain('To: amy@acme.com');
    expect(raw).toContain(`Subject: =?UTF-8?B?${Buffer.from('報價').toString('base64')}?=`);

    await call(routes, '/api/google/connect', { method: 'DELETE', token: 'good' });
    expect(state.tokens['user-1']).toBeUndefined();
  });

  it('rejects tokens without Gmail scopes and clears revoked tokens', async () => {
    const { routes, state } = setup();
    expect((await call(routes, '/api/google/connect', { method: 'POST', token: 'good', body: { refreshToken: 'noscope' } })).body.error).toBe('google_scope_missing');
    state.tokens['user-1'] = { owner_id: 'user-1', refresh_token: 'revoked', google_email: 'x' };
    expect((await call(routes, '/api/gmail/messages', { token: 'good', query: '?email=a@b.co' })).body.error).toBe('google_reauth_required');
    expect(state.tokens['user-1']).toBeUndefined();
  });

  it('validates input', async () => {
    const { routes } = setup();
    expect((await call(routes, '/api/gmail/messages', { token: 'good', query: '?email=not-an-email' })).status).toBe(400);
    expect((await call(routes, '/api/gmail/send', { method: 'POST', token: 'good', body: { to: 'a@b.co\r\nBcc: x@y.z', subject: 's', body: 'b' } })).status).toBe(400);
    expect((await call(routes, '/api/gmail/message', { token: 'good', query: '?id=../../x' })).status).toBe(400);
  });
});

describe('buildRawEmail', () => {
  it('strips header injection from subject', () => {
    const raw = Buffer.from(buildRawEmail('a@b.co', 'Hi\r\nBcc: evil@x.com', 'body'), 'base64').toString('utf8');
    expect(raw).not.toMatch(/\r\nBcc:/);
  });
});
