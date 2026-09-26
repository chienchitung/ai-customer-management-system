import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { GMAIL_SCOPES, isCloud, supabase } from '../lib/supabase';
import { GmailStatus, disconnectGmail, getGmailStatus } from '../lib/gmail';

export interface GmailContextValue {
  status: GmailStatus;
  refresh: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  /** Marks Gmail as disconnected locally, e.g. after a reauth error. */
  markDisconnected: () => void;
}

const DEFAULT: GmailStatus = { available: false, connected: false, email: null };

export const GmailContext = createContext<GmailContextValue>({
  status: DEFAULT, refresh: () => {}, connect: async () => {}, disconnect: async () => {}, markDisconnected: () => {},
});

export const useGmail = () => useContext(GmailContext);

export const useGmailState = (userId: string | null): GmailContextValue => {
  const [status, setStatus] = useState<GmailStatus>(DEFAULT);

  const refresh = useCallback(() => {
    if (!isCloud || !userId) return setStatus(DEFAULT);
    getGmailStatus().then(setStatus).catch(() => setStatus(DEFAULT));
  }, [userId]);

  useEffect(refresh, [refresh]);

  const connect = async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const options = {
      redirectTo: window.location.origin,
      scopes: GMAIL_SCOPES,
      // offline + consent makes Google return a refresh token every time.
      queryParams: { access_type: 'offline', prompt: 'consent' },
    };
    const hasGoogle = data.user?.identities?.some(i => i.provider === 'google');
    if (hasGoogle) await supabase.auth.signInWithOAuth({ provider: 'google', options });
    else await supabase.auth.linkIdentity({ provider: 'google', options });
  };

  const disconnect = async () => {
    await disconnectGmail();
    refresh();
  };

  return { status, refresh, connect, disconnect, markDisconnected: () => setStatus(s => ({ ...s, connected: false })) };
};

export const GmailProvider: React.FC<{ value: GmailContextValue; children: React.ReactNode }> = ({ value, children }) =>
  React.createElement(GmailContext.Provider, { value }, children);
