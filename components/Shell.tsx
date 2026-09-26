import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Customer } from '../types';
import { t } from '../localization';
import { Avatar, StatusBadge } from './ui';
import { SearchIcon, PlusIcon, SparklesIcon } from './icons';

type Language = 'en' | 'zh';
export type MainView = 'today' | 'management' | 'dashboard';

const NAV_ICONS: Record<MainView, React.ReactNode> = {
  today: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  management: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H3.375a4.125 4.125 0 0 1 7.533-2.493M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />,
  dashboard: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />,
};

export const NavIcon: React.FC<{ view: MainView; className?: string }> = ({ view, className = 'w-[18px] h-[18px]' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">{NAV_ICONS[view]}</svg>
);

export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// ---------- Sidebar (desktop) ----------

export const Sidebar: React.FC<{
  view: MainView;
  onChange: (v: MainView) => void;
  todayCount: number;
  customerCount: number;
  language: Language;
  onOpenPalette: () => void;
  onNewCustomer: () => void;
  onCapture: () => void;
  footer: React.ReactNode;
}> = ({ view, onChange, todayCount, customerCount, language, onOpenPalette, onNewCustomer, onCapture, footer }) => {
  const item = (v: MainView, key: string, count?: number, highlight?: boolean) => (
    <button
      key={v}
      onClick={() => onChange(v)}
      aria-current={view === v ? 'page' : undefined}
      title={`${t(`shell.titles.${v}`, language)} (${key})`}
      className={`w-full flex items-center gap-2.5 h-8 px-2 rounded-md text-sm transition-colors ${
        view === v ? 'bg-surface text-text-primary font-medium shadow-sm border border-border' : 'text-text-secondary hover:bg-secondary hover:text-text-primary border border-transparent'
      }`}
    >
      <NavIcon view={v} />
      <span className="flex-grow text-left">{t(`shell.titles.${v}`, language)}</span>
      {count !== undefined && count > 0 && (
        <span className={`text-xs tabular-nums ${highlight ? 'min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white font-semibold flex items-center justify-center' : 'text-text-secondary'}`}>{count}</span>
      )}
    </button>
  );

  return (
    <aside className="hidden md:flex w-60 flex-shrink-0 flex-col bg-sidebar px-3 py-3 gap-4" aria-label={t('settings.menu', language)}>
      <div className="flex items-center gap-2 px-1 h-8">
        <span className="w-6 h-6 rounded-md bg-primary text-on-primary flex items-center justify-center" aria-hidden="true">
          <SparklesIcon className="w-4 h-4" />
        </span>
        <span className="font-semibold text-sm tracking-tight">{language === 'zh' ? 'AI 客戶管理' : 'AI CRM'}</span>
      </div>

      <button onClick={onOpenPalette} className="w-full flex items-center gap-2 h-8 px-2 rounded-md border border-border bg-surface text-sm text-text-secondary hover:border-text-secondary/40 transition-colors shadow-sm">
        <SearchIcon className="w-4 h-4" />
        <span className="flex-grow text-left">{t('shell.search', language)}</span>
        <kbd className="kbd">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav className="space-y-0.5" aria-label="Main">
        {item('today', '1', todayCount, true)}
        {item('management', '2', customerCount)}
        {item('dashboard', '3')}
      </nav>

      <div className="space-y-0.5">
        <p className="px-2 pb-1 text-xs font-medium text-text-secondary">{t('shell.quick', language)}</p>
        <button onClick={onNewCustomer} className="w-full flex items-center gap-2.5 h-8 px-2 rounded-md text-sm text-text-secondary hover:bg-secondary hover:text-text-primary transition-colors" aria-label={t('addNewCustomer', language)}>
          <PlusIcon className="w-[18px] h-[18px]" /><span className="flex-grow text-left">{t('shell.newCustomer', language)}</span><kbd className="kbd">N</kbd>
        </button>
        <button onClick={onCapture} className="w-full flex items-center gap-2.5 h-8 px-2 rounded-md text-sm text-text-secondary hover:bg-secondary hover:text-text-primary transition-colors" aria-label={t('capture.button', language)}>
          <SparklesIcon className="w-[18px] h-[18px]" /><span className="flex-grow text-left">{t('capture.button', language)}</span>
        </button>
      </div>

      <div className="mt-auto">{footer}</div>
    </aside>
  );
};

// ---------- Command palette (⌘K) ----------

interface Command {
  id: string;
  group: 'customers' | 'pages' | 'actions';
  label: string;
  hint?: string;
  icon: React.ReactNode;
  keywords: string;
  run: () => void;
}

export const CommandPalette: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  language: Language;
  onOpenCustomer: (id: string) => void;
  onNavigate: (v: MainView) => void;
  actions: { id: string; label: string; icon: React.ReactNode; run: () => void; hint?: string }[];
}> = ({ isOpen, onClose, customers, language, onOpenCustomer, onNavigate, actions }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Mounted fresh on every open (see App), so query/selection always start empty.

  const commands = useMemo<Command[]>(() => [
    ...customers.map(c => ({
      id: `c-${c.id}`, group: 'customers' as const, label: c.name, hint: c.company,
      icon: <Avatar name={c.name} size="sm" />,
      keywords: `${c.name} ${c.company} ${c.email} ${(c.keyContacts ?? []).map(k => k.name).join(' ')}`.toLowerCase(),
      run: () => onOpenCustomer(c.id),
    })),
    ...(['today', 'management', 'dashboard'] as MainView[]).map((v, i) => ({
      id: `p-${v}`, group: 'pages' as const, label: t(`shell.titles.${v}`, language), hint: String(i + 1),
      icon: <NavIcon view={v} className="w-4 h-4" />, keywords: `${v} ${t(`shell.titles.${v}`, language)}`.toLowerCase(),
      run: () => onNavigate(v),
    })),
    ...actions.map(a => ({ ...a, group: 'actions' as const, keywords: a.label.toLowerCase() })),
  ], [customers, language, actions, onOpenCustomer, onNavigate]);

  const filterCommands = (raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return commands.filter(c => c.group !== 'customers' || commands.indexOf(c) < 5);
    return commands.filter(c => q.split(/\s+/).every(term => c.keywords.includes(term))).slice(0, 30);
  };
  const q = query.trim().toLowerCase();
  const results = useMemo(() => filterCommands(query), [commands, query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!isOpen) return null;

  const run = (cmd?: Command) => {
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      // Use the input's live value so a fast Enter never acts on stale results.
      const live = (e.currentTarget as HTMLInputElement).value;
      run(live === query ? results[active] : filterCommands(live)[0]);
    }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const groups: Command['group'][] = ['customers', 'pages', 'actions'];
  let index = -1;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('shortcuts.palette', language)} className="w-full max-w-xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <SearchIcon className="w-4 h-4 text-text-secondary" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('shell.search', language)}
            aria-label={t('shell.search', language)}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            className="flex-grow h-12 bg-transparent outline-none focus-visible:outline-none text-sm placeholder:text-text-secondary/70"
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <ul id="palette-list" ref={listRef} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-secondary">{t('shell.noResults', language)}</li>}
          {groups.map(group => {
            const items = results.filter(r => r.group === group);
            if (!items.length) return null;
            return (
              <li key={group} role="presentation">
                <p className="px-2 pt-2 pb-1 text-xs font-medium text-text-secondary">{t(`shell.${group}`, language)}</p>
                <ul role="presentation">
                  {items.map(cmd => {
                    index += 1;
                    const i = index;
                    const customer = cmd.group === 'customers' ? customers.find(c => `c-${c.id}` === cmd.id) : null;
                    return (
                      <li
                        key={cmd.id}
                        id={`cmd-${cmd.id}`}
                        role="option"
                        aria-selected={i === active}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onClick={() => run(cmd)}
                        className={`flex items-center gap-3 px-2 h-9 rounded-md cursor-pointer text-sm ${i === active ? 'bg-secondary text-text-primary' : 'text-text-primary'}`}
                      >
                        <span className="text-text-secondary flex-shrink-0">{cmd.icon}</span>
                        <span className="truncate">{cmd.label}</span>
                        {cmd.hint && <span className="text-xs text-text-secondary truncate">{cmd.hint}</span>}
                        {customer && <span className="ml-auto"><StatusBadge status={customer.status} language={language} /></span>}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
        <div className="px-4 py-2 border-t border-border text-xs text-text-secondary flex gap-4">
          <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> {language === 'zh' ? '選擇' : 'Navigate'}</span>
          <span><kbd className="kbd">Enter</kbd> {language === 'zh' ? '開啟' : 'Open'}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};
