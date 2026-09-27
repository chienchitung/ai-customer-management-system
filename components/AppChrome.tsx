import { Monitor, MoreHorizontal } from 'lucide-react';
import { NavIcon } from './Shell';
import React from 'react';
import { DropdownMenu as Menu } from 'radix-ui';
import { t } from '../localization';
import { SyncStatus } from '../hooks/useCustomerStore';
import { CheckIcon } from './icons';
import { Avatar } from './ui';

type Language = 'en' | 'zh';
export interface MenuItem { label: string; onClick: () => void; danger?: boolean; }
export type SettingsSection = 'account' | 'preferences' | 'integrations' | 'data';

export const SyncBadge: React.FC<{ status: SyncStatus; onRetry: () => void; language: Language }> = ({ status, onRetry, language }) => {
  if (status === 'error') return <button onClick={onRetry} className="chip text-rose-600" role="status">{t('sync.error', language)} · {t('sync.retry', language)}</button>;
  if (status === 'saved') return null;
  return <span role="status" className="text-xs text-text-secondary flex items-center gap-1"><CheckIcon className="w-3.5 h-3.5" />{status === 'local' ? (language === 'zh' ? '本機儲存' : 'Local storage') : t('sync.' + status, language)}</span>;
};

export const SettingsMenu: React.FC<{
  language: Language; userEmail: string | null;
  onOpenSettings: (section: SettingsSection) => void;
  onShowShortcuts: () => void; onSignOut: () => void;
  variant?: 'icon' | 'account';
}> = ({ language, userEmail, onOpenSettings, onShowShortcuts, onSignOut, variant = 'icon' }) => {
  const zh = language === 'zh';
  const name = userEmail?.split('@')[0] || (zh ? '本機模式' : 'Local mode');
  const identity = userEmail ? <Avatar name={name} size="sm" /> : <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center" aria-hidden="true"><Monitor className="w-5 h-5" /></span>;
  const entries: [SettingsSection, string][] = [
    ['account', zh ? '帳號資訊' : 'Account'],
    ['preferences', zh ? '外觀與語言' : 'Appearance & language'],
    ['integrations', zh ? '整合服務' : 'Integrations'],
    ['data', zh ? '資料管理' : 'Data management'],
  ];
  return <Menu.Root>
    <Menu.Trigger asChild>
      <button className={variant === 'account' ? 'w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary text-left' : 'btn btn-ghost btn-icon'} aria-label={zh ? '帳號與設定' : 'Account & settings'}>
        {identity}
        {variant === 'account' && <span className="min-w-0 flex-grow"><span className="block text-sm font-semibold truncate">{name}</span><span className="block text-xs text-text-secondary truncate">{userEmail || (zh ? '僅限此裝置' : 'This device only')}</span></span>}
        {variant === 'account' && <MoreHorizontal className="w-4 h-4" aria-hidden="true" />}
      </button>
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content side={variant === 'account' ? 'right' : 'bottom'} align="end" sideOffset={8} collisionPadding={12} className="z-[100] w-64 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-surface p-1.5 text-text-primary shadow-xl outline-none">
        <Menu.Label className="px-2 py-3"><span className="block text-sm font-semibold">{name}</span><span className="block text-xs text-text-secondary truncate">{userEmail || (zh ? '尚未登入雲端帳號' : 'No cloud account signed in')}</span></Menu.Label>
        <Menu.Separator className="h-px bg-border my-1" />
        {entries.map(([section, label]) => <Menu.Item key={section} onSelect={() => onOpenSettings(section)} className="px-3 py-2.5 text-sm rounded-md cursor-pointer outline-none data-[highlighted]:bg-secondary">{label}</Menu.Item>)}
        <Menu.Separator className="h-px bg-border my-1" />
        <Menu.Item onSelect={onShowShortcuts} className="px-3 py-2.5 text-sm rounded-md cursor-pointer outline-none data-[highlighted]:bg-secondary">{zh ? '說明與快捷鍵' : 'Help & shortcuts'}</Menu.Item>
        {userEmail && <><Menu.Separator className="h-px bg-border my-1" /><Menu.Item onSelect={onSignOut} className="px-3 py-2.5 text-sm text-rose-600 rounded-md cursor-pointer outline-none data-[highlighted]:bg-secondary">{t('settings.signOut', language)}</Menu.Item></>}
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
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
          <NavIcon view={i.key} className="w-6 h-6" />
          {i.label}
          {i.key === 'today' && todayCount > 0 && (
            <span className="absolute top-1 left-1/2 ml-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{todayCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
};
