import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiJson } from '../lib/api';

/**
 * Tracks the Supabase session. Right after a Google sign-in the session carries
 * a provider refresh token; we hand it to the server once so it can call Gmail.
 */
export const useAuth = (onGmailConnected?: () => void) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
      const refreshToken = next?.provider_refresh_token;
      if (refreshToken) {
        apiJson('/api/google/connect', { method: 'POST', body: JSON.stringify({ refreshToken }) })
          .then(() => onGmailConnected?.())
          .catch(err => console.warn('Gmail connect failed:', err));
      }
    });
    return () => data.subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    session,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    loading,
    signOut: () => supabase?.auth.signOut(),
  };
};
