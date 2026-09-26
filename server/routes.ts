import { GoogleGenAI } from '@google/genai';
import { Handler, HttpError, readJson, route, sendJson, queryParams } from './http.js';
import { ServerConfig, configFromEnv } from './config.js';
import { LOCAL_USER, createAdmin, requireUser } from './supabase.js';
import { GMAIL_SCOPES, getMessageText, getProfileEmail, listMessagesWith, listRecentInbox, refreshAccessToken, revokeToken, sendEmail } from './google.js';

// All API routes, shared by Vercel functions (api/) and the Vite dev server.

interface AIRequestBody {
  contents: { role: 'user' | 'model'; text: string }[];
  systemInstruction?: string;
  responseSchema?: unknown;
  stream?: boolean;
}

const MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const isRateLimit = (error: any) => /429|resource_exhausted|quota/i.test(String(error?.message || error));

export const createRoutes = (config: ServerConfig, fetchImpl: typeof fetch = fetch): Record<string, Handler> => {
  const ai = config.geminiApiKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null;
  const admin = createAdmin(config, fetchImpl);

  const aiHandler: Handler = async (req, res) => {
    const userId = await requireUser(req, config, fetchImpl);
    if (!ai) throw new HttpError(500, 'missing_api_key');

    const body = await readJson<AIRequestBody>(req);
    if (!Array.isArray(body?.contents) || body.contents.length === 0 || body.contents.length > 60) {
      throw new HttpError(400, 'bad_request');
    }
    if (userId !== LOCAL_USER && admin.enabled && !(await admin.consumeAiQuota(userId, config.aiDailyLimit))) {
      throw new HttpError(429, 'quota_exceeded');
    }

    const request = {
      model: MODEL,
      contents: body.contents.map(c => ({ role: c.role === 'model' ? 'model' : 'user', parts: [{ text: String(c.text).slice(0, 20000) }] })),
      config: {
        ...(body.systemInstruction ? { systemInstruction: String(body.systemInstruction).slice(0, 30000) } : {}),
        ...(body.responseSchema ? { responseMimeType: 'application/json', responseSchema: body.responseSchema as any } : {}),
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
          for await (const chunk of stream) if (chunk.text) res.write(chunk.text);
          res.end();
          return;
        }
        const response = await ai.models.generateContent(request);
        return sendJson(res, 200, { text: (response.text ?? '').trim() });
      } catch (error) {
        if (res.headersSent) throw error;
        if (isRateLimit(error) && attempt < MAX_RETRIES - 1) {
          await delay(backoff);
          backoff = backoff * 2 + Math.random() * 1000;
          continue;
        }
        console.error('[ai] Gemini call failed:', error);
        throw new HttpError(isRateLimit(error) ? 429 : 502, isRateLimit(error) ? 'rate_limited' : 'upstream_error');
      }
    }
  };

  /** Resolves the signed-in user's Gmail access token (throws 409 when not connected). */
  const gmailSession = async (req: Parameters<Handler>[0]) => {
    const userId = await requireUser(req, config, fetchImpl);
    if (userId === LOCAL_USER || !admin.enabled) throw new HttpError(501, 'google_not_configured');
    const stored = await admin.getGoogleToken(userId);
    if (!stored) throw new HttpError(409, 'google_not_connected');
    try {
      const { accessToken } = await refreshAccessToken(config, stored.refresh_token, fetchImpl);
      return { userId, accessToken, ownEmail: stored.google_email };
    } catch (error) {
      if (error instanceof HttpError && error.code === 'google_reauth_required') await admin.deleteGoogleToken(userId);
      throw error;
    }
  };

  const googleConnect = route({
    // Stores the refresh token captured right after Google sign-in.
    POST: async (req, res) => {
      const userId = await requireUser(req, config, fetchImpl);
      if (userId === LOCAL_USER || !admin.enabled) throw new HttpError(501, 'google_not_configured');
      const { refreshToken } = await readJson<{ refreshToken?: string }>(req);
      if (!refreshToken || typeof refreshToken !== 'string') throw new HttpError(400, 'bad_request');
      const { accessToken, scope } = await refreshAccessToken(config, refreshToken, fetchImpl);
      if (!GMAIL_SCOPES.every(s => scope.includes(s))) throw new HttpError(403, 'google_scope_missing');
      const email = await getProfileEmail(accessToken, fetchImpl);
      await admin.saveGoogleToken(userId, refreshToken, scope, email);
      sendJson(res, 200, { connected: true, email });
    },
    GET: async (req, res) => {
      const userId = await requireUser(req, config, fetchImpl);
      const available = userId !== LOCAL_USER && admin.enabled && !!config.googleClientId;
      const stored = available ? await admin.getGoogleToken(userId) : null;
      sendJson(res, 200, { available, connected: !!stored, email: stored?.google_email ?? null });
    },
    DELETE: async (req, res) => {
      const userId = await requireUser(req, config, fetchImpl);
      if (userId === LOCAL_USER || !admin.enabled) throw new HttpError(501, 'google_not_configured');
      const stored = await admin.getGoogleToken(userId);
      if (stored) await revokeToken(stored.refresh_token, fetchImpl);
      await admin.deleteGoogleToken(userId);
      sendJson(res, 200, { connected: false });
    },
  });

  const gmailMessages = route({
    GET: async (req, res) => {
      const params = queryParams(req);
      const max = Math.min(Math.max(Number(params.get('max')) || 15, 1), 30);
      if (params.get('inbox')) {
        const { accessToken, ownEmail } = await gmailSession(req);
        return sendJson(res, 200, { messages: await listRecentInbox(accessToken, ownEmail, max, fetchImpl) });
      }
      const email = (params.get('email') ?? '').trim();
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'bad_request');
      const { accessToken, ownEmail } = await gmailSession(req);
      sendJson(res, 200, { messages: await listMessagesWith(accessToken, email, ownEmail, max, fetchImpl) });
    },
  });

  const gmailMessage = route({
    GET: async (req, res) => {
      const id = queryParams(req).get('id') ?? '';
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new HttpError(400, 'bad_request');
      const { accessToken } = await gmailSession(req);
      sendJson(res, 200, await getMessageText(accessToken, id, fetchImpl));
    },
  });

  const gmailSend = route({
    POST: async (req, res) => {
      const { to, subject, body, threadId } = await readJson<{ to?: string; subject?: string; body?: string; threadId?: string }>(req);
      if (!to || !EMAIL_RE.test(to) || !subject?.trim() || !body?.trim() || subject.length > 500 || body.length > 50000) {
        throw new HttpError(400, 'bad_request');
      }
      const { accessToken } = await gmailSession(req);
      sendJson(res, 200, await sendEmail(accessToken, to, subject, body, threadId, fetchImpl));
    },
  });

  return {
    '/api/ai': route({ POST: aiHandler }),
    '/api/google/connect': googleConnect,
    '/api/gmail/messages': gmailMessages,
    '/api/gmail/message': gmailMessage,
    '/api/gmail/send': gmailSend,
  };
};

let cached: Record<string, Handler> | null = null;
/** Routes configured from process.env (used by Vercel functions). */
export const routesFromProcessEnv = () => (cached ??= createRoutes(configFromEnv(process.env)));
