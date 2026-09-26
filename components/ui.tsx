import React from 'react';
import { CustomerStatus } from '../types';
import { translateStatus } from '../localization';

// Small shared presentational primitives for the redesigned UI.

export const STATUS_DOT: Record<CustomerStatus, string> = {
  [CustomerStatus.LEAD]: 'bg-zinc-400',
  [CustomerStatus.PROSPECT]: 'bg-sky-500',
  [CustomerStatus.NEGOTIATION]: 'bg-amber-500',
  [CustomerStatus.CLOSED_WON]: 'bg-emerald-500',
  [CustomerStatus.CLOSED_LOST]: 'bg-rose-500',
};

export const StatusBadge: React.FC<{ status: CustomerStatus; language: 'en' | 'zh'; className?: string }> = ({ status, language, className = '' }) => (
  <span className={`chip ${className}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
    {translateStatus(status, language)}
  </span>
);

// Muted, deterministic avatar colors (readable text in both themes).
const AVATAR_TONES = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
];

const initials = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // CJK names: use the first character; Latin names: first letters of first two words.
  if (/[㐀-鿿]/.test(trimmed[0])) return trimmed[0];
  return trimmed.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
};

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg' }> = ({ name, size = 'md' }) => {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-11 h-11 text-sm' };
  return (
    <span aria-hidden="true" className={`${sizes[size]} ${AVATAR_TONES[hash % AVATAR_TONES.length]} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials(name)}
    </span>
  );
};

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function Tabs<K extends string>({ tabs, active, onChange, label }: { tabs: TabItem<K>[]; active: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-border">
      {tabs.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative px-3 py-2 text-sm font-medium transition-colors -mb-px border-b-2 ${
            active === tab.key ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && <span className="ml-1.5 text-xs text-text-secondary">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
