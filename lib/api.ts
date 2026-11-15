import { getAccessToken } from './supabase';
import { askForAccessCode, getAccessCode, setAccessCode } from './accessCode';

// Fetch wrapper for our /api routes: attaches the Supabase access token and
// turns error responses into ApiError with the server's error code.

export class ApiError extends Error {
  constructor(public code: string, public status: number, public detail?: string) {
    super(code);
  }
}

const send = async (path: string, init: RequestInit, accessCode: string | null): Promise<Response> => {
  const token = await getAccessToken();
  try {
    return await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(accessCode ? { 'X-Access-Code': accessCode } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('network', 0);
  }
};

const ACCESS_ERRORS = ['access_code_required', 'access_code_invalid'];

export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  let code = getAccessCode();
  let res = await send(path, init, code);
  // The server may ask for the deployment's access code; ask the user and retry (twice at most).
  for (let attempt = 0; attempt < 2 && res.status === 401; attempt++) {
    const data = await res.clone().json().catch(() => ({}));
    if (!ACCESS_ERRORS.includes(data.error)) break;
    setAccessCode(null);
    code = await askForAccessCode(data.error === 'access_code_invalid' || code ? 'invalid' : 'required');
    if (!code) break;
    res = await send(path, init, code);
    if (res.ok) setAccessCode(code);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'upstream_error', res.status, typeof data.detail === 'string' ? data.detail : undefined);
  }
  return res;
};

export const apiJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => (await apiFetch(path, init)).json();
