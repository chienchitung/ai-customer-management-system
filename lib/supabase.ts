import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Cloud mode is enabled when the Supabase env vars are present; otherwise the
// app runs in local mode (browser storage only), which is handy for demos.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null;

export const isCloud = !!supabase;

export const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';

export const getAccessToken = async (): Promise<string | null> =>
  supabase ? (await supabase.auth.getSession()).data.session?.access_token ?? null : null;
