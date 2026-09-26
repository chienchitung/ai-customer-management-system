import { getAccessToken } from './supabase';

// Fetch wrapper for our /api routes: attaches the Supabase access token and
// turns error responses into ApiError with the server's error code.

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export const apiFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const token = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError('network', 0);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.error || 'upstream_error', res.status);
  }
  return res;
};

export const apiJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => (await apiFetch(path, init)).json();
