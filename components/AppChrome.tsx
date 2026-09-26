import React, { useEffect, useRef, useState } from 'react';
import { t } from '../localization';
import { SyncStatus } from '../hooks/useCustomerStore';
import { useGmail } from '../hooks/useGmail';
import { isCloud } from '../lib/supabase';
import { CheckIcon } from './icons';
import { Avatar } from './ui';

type Language = 'en' | 'zh';

// ---------- Save status ----------

export const SyncBadge: React.FC<{ status: SyncStatus; onRetry: () => void; language: Language }> = ({ status, onRetry, language }) => {
  if (status === 'error') {
    return (
      <button onClick={onRetry} className="chip border-rose-300 text-rose-700 dark:border-rose-500/40 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10" role="status">
        ⚠ {t('sync.error', language)} · {t('sync.retry', language)}
      </button>
    );
  }
  const label = status === 'local' ? t('sync.local', language) : t(`sync.${status}`, language);
  return (
    <span role="status" className="text-xs text-text-secondary flex items-center gap-1 whitespace-nowrap" title={label}>
      {status === 'saved' || status === 'local' ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
};

// ---------- Settings / account menu ----------

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export const SettingsMenu: React.FC<{
  language: Language;
  theme: 'light' | 'dark';
  userEmail: string | null;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  dataItems: MenuItem[];
  onShowShortcuts: () => void;
  onSignOut: () => void;
  /** 'account' renders a full-width account row (sidebar) that opens upward. */
  variant?: 'icon' | 'account';
}> = ({ language, theme, userEmail, onToggleLanguage, onToggleTheme, dataItems, onShowShortcuts, onSignOut, variant = 'icon' }) => {
  const [open, setOpen] = useState(false);
  const gmail = useGmail();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape and return focus to the menu button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  const item = 'w-full text-left px-3 h-8 mx-1 rounded-md hover:bg-secondary flex items-center justify-between gap-3 max-w-[calc(100%-0.5rem)]';

  return (
    <div className="relative">
      {variant === 'account' ? (
        <button
          ref={buttonRef}
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-secondary transition-colors text-left"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t('settings.menu', language)}
        >
          <Avatar name={userEmail ?? (language === 'zh' ? '我' : 'Me')} size="sm" />
          <span className="flex-grow min-w-0">
            <span className="block text-sm font-medium truncate">{userEmail ?? t('settings.localMode', language).split('（')[0].split(' (')[0]}</span>
            {gmail.status.connected && <span className="block text-xs text-text-secondary truncate">✉ {gmail.status.email}</span>}
          </span>
          <svg viewBox="0 0 20 20" className="w-4 h-4 text-text-secondary" fill="currentColor" aria-hidden="true"><path d="M10 3l4 5H6l4-5zm0 14l-4-5h8l-4 5z" /></svg>
        </button>
      ) : (
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        className="btn btn-ghost btn-icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('settings.menu', language)}
        title={t('settings.menu', language)}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="menu" className={`absolute w-72 bg-surface border border-border rounded-lg shadow-xl z-40 py-1 text-sm ${variant === 'account' ? 'left-0 bottom-full mb-2' : 'right-0 mt-2'}`}>
            <div className="px-4 py-2 text-xs text-text-secondary border-b border-border truncate">
              {isCloud ? userEmail : t('settings.localMode', language)}
            </div>
            <button role="menuitem" className={item} onClick={onToggleLanguage}>
              {t('settings.language', language)}<span className="text-text-secondary">{language === 'zh' ? '中文' : 'English'}</span>
            </button>
            <button role="menuitemcheckbox" aria-checked={theme === 'dark'} className={item} onClick={onToggleTheme}>
              {t('settings.theme', language)}
              <span className={`w-9 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-border'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-4' : 'left-0.5'}`} />
              </span>
            </button>
            {gmail.status.available && (
              <div className="border-t border-border mt-1 pt-1">
                {gmail.status.connected ? (
                  <>
                    <p className="px-4 py-1 text-xs text-text-secondary truncate">✉ {t('gmail.connected', language).replace('{email}', gmail.status.email ?? '')}</p>
                    <button role="menuitem" className={item} onClick={run(gmail.disconnect)}>{t('gmail.disconnect', language)}</button>
                  </>
                ) : (
                  <button role="menuitem" className={item} onClick={run(gmail.connect)}>✉ {t('gmail.connect', language)}</button>
                )}
              </div>
            )}
            <div className="border-t border-border mt-1 pt-1">
              {dataItems.map(d => (
                <button key={d.label} role="menuitem" className={`${item} ${d.danger ? 'text-rose-600 dark:text-rose-400' : ''}`} onClick={run(d.onClick)}>{d.label}</button>
              ))}
              <button role="menuitem" className={`${item} hidden md:flex`} onClick={run(onShowShortcuts)}>
                {t('shortcuts.title', language)}<kbd className="kbd">?</kbd>
              </button>
            </div>
            {isCloud && (
              <div className="border-t border-border mt-1 pt-1">
                <button role="menuitem" className={item} onClick={run(onSignOut)}>{t('settings.signOut', language)}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ---------- Mobile bottom navigation ----------

export const BottomNav: React.FC<{
  view: 'today' | 'management' | 'dashboard';
  onChange: (v: 'today' | 'management' | 'dashboard') => void;
  todayCount: number;
  language: Language;
}> = ({ view, onChange, todayCount, language }) => {
  const items: { key: 'today' | 'management' | 'dashboard'; label: string; icon: React.ReactNode }[] = [
    { key: 'today', label: t('today', language), icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> },
    { key: 'management', label: t('management', language), icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H3.375a4.125 4.125 0 0 1 7.533-2.493M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /> },
    { key: 'dashboard', label: t('dashboard', language), icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /> },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-border flex pb-[env(safe-area-inset-bottom)]" aria-label="Mobile">
      {items.map(i => (
        <button
          key={i.key}
          onClick={() => onChange(i.key)}
          aria-current={view === i.key ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs font-medium relative ${view === i.key ? 'text-primary' : 'text-text-secondary'}`}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">{i.icon}</svg>
          {i.label}
          {i.key === 'today' && todayCount > 0 && (
            <span className="absolute top-1 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{todayCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
};
