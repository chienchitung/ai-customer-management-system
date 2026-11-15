import { GoogleGenAI } from '@google/genai';
import { Handler, HttpError, readJson, route, sendJson, queryParams } from './http.js';
import { ServerConfig, configFromEnv } from './config.js';
import { ACCESS_CODE_USER, LOCAL_USER, createAdmin, requireUser } from './supabase.js';
import { MAX_DOCUMENT_BYTES, DOCUMENT_TYPES, checkComPDFTask, signTask, startComPDFTask, verifyTask } from './compdf.js';
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
const isKeyProblem = (error: any) => /API_KEY_INVALID|API key not valid|ACCESS_TOKEN_TYPE_UNSUPPORTED|API_KEY_SERVICE_BLOCKED|PERMISSION_DENIED|UNAUTHENTICATED/i.test(String(error?.message || error));

/** Gemini's own one-line reason (e.g. "API key not valid"), without request details. */
const geminiReason = (error: any) => {
  const raw = String(error?.message || error);
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf('{')));
    const e = parsed.error ?? parsed;
    return [e.status, String(e.message ?? '').split('\n')[0]].filter(Boolean).join(': ').slice(0, 160);
  } catch {
    return raw.split('\n')[0].slice(0, 160);
  }
};

export const createRoutes = (config: ServerConfig, fetchImpl: typeof fetch = fetch): Record<string, Handler> => {
  const ai = config.geminiApiKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null;
  const admin = createAdmin(config, fetchImpl);

  // Access-code mode has no database, so its daily limit is counted per server instance. It is a
  // rough cap (each warm instance counts separately), enough to stop a leaked code from running up a bill.
  const accessUsage = { day: '', count: 0 };
  /** Counts one AI or document call against the user's daily limit; false when the limit is reached. */
  const consumeQuota = async (userId: string) => {
    if (userId === LOCAL_USER) return true;
    if (userId === ACCESS_CODE_USER) {
      const day = new Date().toISOString().slice(0, 10);
      if (accessUsage.day !== day) { accessUsage.day = day; accessUsage.count = 0; }
      return ++accessUsage.count <= config.aiDailyLimit;
    }
    return !admin.enabled || admin.consumeAiQuota(userId, config.aiDailyLimit);
  };

  const aiHandler: Handler = async (req, res) => {
    const userId = await requireUser(req, config, fetchImpl);
    if (!ai) throw new HttpError(500, 'missing_api_key');

    const body = await readJson<AIRequestBody>(req);
    if (!Array.isArray(body?.contents) || body.contents.length === 0 || body.contents.length > 60) {
      throw new HttpError(400, 'bad_request');
    }
    if (!(await consumeQuota(userId))) {
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
        if (isKeyProblem(error)) throw new HttpError(502, 'ai_key_invalid', geminiReason(error));
        throw new HttpError(isRateLimit(error) ? 429 : 502, isRateLimit(error) ? 'rate_limited' : 'upstream_error', geminiReason(error));
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

  const documentParse = route({
    // Starts turning an uploaded PDF or image into text with ComPDF and returns a signed task
    // token; GET polls it. The AI analysis runs afterwards through /api/ai.
    POST: async (req, res) => {
      const userId = await requireUser(req, config, fetchImpl);
      if (!config.compdfApiKey) throw new HttpError(501, 'compdf_not_configured');
      const body = await readJson<{ fileName?: string; contentType?: string; dataBase64?: string }>(req, Math.ceil(MAX_DOCUMENT_BYTES * 1.4) + 2000);
      const { fileName, contentType, dataBase64 } = body ?? {};
      if (!fileName || typeof fileName !== 'string' || !contentType || !dataBase64 || typeof dataBase64 !== 'string') {
        throw new HttpError(400, 'bad_request');
      }
      if (!DOCUMENT_TYPES[contentType]) throw new HttpError(415, 'unsupported_document');
      const bytes = Buffer.from(dataBase64, 'base64');
      if (bytes.length === 0) throw new HttpError(400, 'bad_request');
      if (bytes.length > MAX_DOCUMENT_BYTES) throw new HttpError(413, 'payload_too_large');
      if (!(await consumeQuota(userId))) {
        throw new HttpError(429, 'quota_exceeded');
      }
      const taskId = await startComPDFTask(config, { fileName, contentType, bytes }, fetchImpl);
      sendJson(res, 200, { task: signTask(config, userId, taskId) });
    },
    GET: async (req, res) => {
      const userId = await requireUser(req, config, fetchImpl);
      if (!config.compdfApiKey) throw new HttpError(501, 'compdf_not_configured');
      const taskId = verifyTask(config, userId, queryParams(req).get('task') ?? '');
      const result = await checkComPDFTask(config, taskId, fetchImpl);
      sendJson(res, 200, result ? { status: 'done', ...result } : { status: 'processing' });
    },
  });

  return {
    '/api/ai': route({ POST: aiHandler }),
    '/api/documents/parse': documentParse,
    '/api/google/connect': googleConnect,
    '/api/gmail/messages': gmailMessages,
    '/api/gmail/message': gmailMessage,
    '/api/gmail/send': gmailSend,
  };
};

let cached: Record<string, Handler> | null = null;
/** Routes configured from process.env (used by Vercel functions). */
export const routesFromProcessEnv = () => (cached ??= createRoutes(configFromEnv(process.env)));
