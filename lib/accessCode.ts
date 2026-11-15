// Access code for deployments without Supabase login (see APP_ACCESS_CODE on the server).
// The code is kept in this browser after it works once; a wrong code is forgotten.

const KEY = 'aicms.accessCode.v1';

export const getAccessCode = (): string | null => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};
export const setAccessCode = (code: string | null) => {
  try { if (code) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};

type Prompt = (reason: 'required' | 'invalid') => Promise<string | null>;
let prompt: Prompt | null = null;
let pending: Promise<string | null> | null = null;

/** The app registers its dialog here; apiFetch calls it when the server asks for a code. */
export const registerAccessCodePrompt = (fn: Prompt | null) => { prompt = fn; };

/** Asks once even when several requests hit the gate at the same time. */
export const askForAccessCode = (reason: 'required' | 'invalid'): Promise<string | null> => {
  if (!prompt) return Promise.resolve(null);
  pending ??= prompt(reason).finally(() => { pending = null; });
  return pending;
};
