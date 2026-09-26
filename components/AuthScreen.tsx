import React, { useState } from 'react';
import { supabase, GMAIL_SCOPES } from '../lib/supabase';
import { t } from '../localization';

type Language = 'en' | 'zh';

const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const AuthScreen: React.FC<{ language: Language; onToggleLanguage: () => void }> = ({ language, onToggleLanguage }) => {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const google = async () => {
    setError(null);
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin, scopes: GMAIL_SCOPES, queryParams: { access_type: 'offline', prompt: 'consent' } },
    });
    if (error) setError(t('auth.errors.generic', language));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signIn') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
        if (error) setError(t(error.status === 400 ? 'auth.errors.invalid' : 'auth.errors.generic', language));
      } else {
        const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) setError(error.message || t('auth.errors.generic', language));
        else if (!data.session) setNotice(t('auth.checkEmail', language));
      }
    } finally {
      setBusy(false);
    }
  };

  const input = 'input h-10';

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm card shadow-sm p-7 space-y-5">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t('auth.title', language)}</h1>
            <p className="text-sm text-text-secondary mt-1">{t('auth.subtitle', language)}</p>
          </div>
          <button onClick={onToggleLanguage} className="btn btn-sm btn-secondary">
            {language === 'en' ? '中文' : 'EN'}
          </button>
        </div>

        <div className="space-y-2">
          <button onClick={google} className="btn btn-secondary w-full h-10">
            <GoogleLogo />{t('auth.google', language)}
          </button>
          <p className="text-xs text-text-secondary">{t('auth.googleHint', language)}</p>
        </div>

        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <div className="h-px bg-border flex-grow" />{t('auth.or', language)}<div className="h-px bg-border flex-grow" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input type="email" required autoComplete="email" placeholder={t('auth.email', language)} aria-label={t('auth.email', language)} value={email} onChange={e => setEmail(e.target.value)} className={input} />
          <input type="password" required minLength={6} autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} placeholder={t('auth.password', language)} aria-label={t('auth.password', language)} value={password} onChange={e => setPassword(e.target.value)} className={input} />
          {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full h-10">
            {t(mode === 'signIn' ? 'auth.signIn' : 'auth.signUp', language)}
          </button>
        </form>
        <button onClick={() => { setMode(m => (m === 'signIn' ? 'signUp' : 'signIn')); setError(null); setNotice(null); }} className="w-full text-sm text-primary hover:underline">
          {t(mode === 'signIn' ? 'auth.toSignUp' : 'auth.toSignIn', language)}
        </button>
      </div>
    </div>
  );
};

export default AuthScreen;
