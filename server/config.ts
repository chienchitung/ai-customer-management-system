export interface ServerConfig {
  geminiApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  compdfApiKey?: string;
  compdfBaseUrl: string;
  aiDailyLimit: number;
  /** When Supabase isn't configured outside production, requests run as a single local user. */
  allowLocalMode: boolean;
}

export const configFromEnv = (env: Record<string, string | undefined>): ServerConfig => ({
  geminiApiKey: env.GEMINI_API_KEY || undefined,
  supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL || undefined,
  supabaseAnonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || undefined,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  googleClientId: env.GOOGLE_CLIENT_ID || undefined,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET || undefined,
  compdfApiKey: env.COMPDF_API_KEY?.trim() || undefined, // pasted keys often carry a trailing newline
  compdfBaseUrl: (env.COMPDF_API_BASE_URL || 'https://api-server.compdf.com/server').replace(/\/+$/, ''),
  aiDailyLimit: Number(env.AI_DAILY_LIMIT) > 0 ? Number(env.AI_DAILY_LIMIT) : 300,
  allowLocalMode: !env.VERCEL && env.NODE_ENV !== 'production',
});
