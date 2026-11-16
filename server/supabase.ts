import { timingSafeEqual } from 'crypto';
import { HttpError, Req, bearerToken } from './http.js';
import { ServerConfig } from './config.js';

// Minimal Supabase REST access for the server: verifying user tokens and
// reading/writing server-only tables with the service role key.

export const LOCAL_USER = 'local';
/** Everyone who unlocked the API with APP_ACCESS_CODE shares this identity (and its daily limit). */
export const ACCESS_CODE_USER = 'access-code';
/** Visitors of a deployment with neither Supabase nor an access code: open, but under a shared daily cap. */
export const ANONYMOUS_USER = 'anonymous';

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const userCache = new Map<string, { id: string; expires: number }>();

/** Returns the signed-in user's id, or throws 401. */
export const requireUser = async (req: Req, config: ServerConfig, fetchImpl: typeof fetch = fetch): Promise<string> => {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    if (config.allowLocalMode) return LOCAL_USER;
    // Without Supabase there is no login. Set APP_ACCESS_CODE to keep strangers from spending the
    // Gemini and ComPDF keys behind this public URL; without it the API is open to anyone, limited
    // only by the shared daily cap (AI_DAILY_LIMIT).
    if (config.appAccessCode) {
      const given = String(req.headers['x-access-code'] ?? '').trim();
      if (!given) throw new HttpError(401, 'access_code_required');
      if (!sameText(given, config.appAccessCode)) throw new HttpError(401, 'access_code_invalid');
      return ACCESS_CODE_USER;
    }
    return ANONYMOUS_USER;
  }
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, 'unauthorized');

  const cached = userCache.get(token);
  if (cached && cached.expires > Date.now()) return cached.id;

  const res = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new HttpError(401, 'unauthorized');
  const user = (await res.json()) as { id?: string };
  if (!user.id) throw new HttpError(401, 'unauthorized');
  if (userCache.size > 1000) userCache.clear();
  userCache.set(token, { id: user.id, expires: Date.now() + 60_000 });
  return user.id;
};

export const createAdmin = (config: ServerConfig, fetchImpl: typeof fetch = fetch) => {
  const enabled = !!(config.supabaseUrl && config.supabaseServiceRoleKey);
  const call = async (path: string, init: RequestInit = {}) => {
    if (!enabled) throw new HttpError(500, 'server_misconfigured');
    const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: config.supabaseServiceRoleKey!,
        Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      console.error('[supabase admin]', path, res.status, await res.text().catch(() => ''));
      throw new HttpError(502, 'database_error');
    }
    return res;
  };

  return {
    enabled,
    async getGoogleToken(ownerId: string): Promise<{ refresh_token: string; google_email: string | null } | null> {
      const res = await call(`google_tokens?owner_id=eq.${encodeURIComponent(ownerId)}&select=refresh_token,google_email`);
      const rows = (await res.json()) as { refresh_token: string; google_email: string | null }[];
      return rows[0] ?? null;
    },
    async saveGoogleToken(ownerId: string, refreshToken: string, scope: string, googleEmail: string) {
      await call('google_tokens', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ owner_id: ownerId, refresh_token: refreshToken, scope, google_email: googleEmail, updated_at: new Date().toISOString() }),
      });
    },
    async deleteGoogleToken(ownerId: string) {
      await call(`google_tokens?owner_id=eq.${encodeURIComponent(ownerId)}`, { method: 'DELETE' });
    },
    /** Returns false when the user's daily AI quota is exhausted. */
    async consumeAiQuota(ownerId: string, limit: number): Promise<boolean> {
      const res = await call('rpc/consume_ai_quota', { method: 'POST', body: JSON.stringify({ p_owner: ownerId, p_limit: limit }) });
      return (await res.json()) === true;
    },
  };
};

export type Admin = ReturnType<typeof createAdmin>;
