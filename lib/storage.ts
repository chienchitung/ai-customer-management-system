import { Customer, CustomerStatus, InteractionType } from '../types';

// Local persistence. Every read/write is guarded because storage can be
// unavailable (private mode, quota, blocked site data).

const CUSTOMERS_KEY = 'aicms.customers.v1';
const PREFS_KEY = 'aicms.prefs.v1';

export interface Prefs {
  language: 'en' | 'zh';
  theme: 'light' | 'dark';
  viewMode: 'list' | 'kanban';
  mainView: 'today' | 'management' | 'dashboard';
  isAIAssistantOpen: boolean;
}

const defaultLanguage = (): Prefs['language'] =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'zh';

const defaultTheme = (): Prefs['theme'] =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const loadPrefs = (): Prefs => {
  const defaults: Prefs = {
    language: defaultLanguage(),
    theme: defaultTheme(),
    viewMode: 'list',
    mainView: 'today',
    isAIAssistantOpen: true,
  };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
};

export const savePrefs = (prefs: Prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable */
  }
};

export const loadCustomers = (fallback: Customer[]): Customer[] => {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    if (!raw) return fallback;
    const parsed = parseCustomers(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

/** Returns false when the write failed, so the UI can warn the user. */
export const saveCustomers = (customers: Customer[]): boolean => {
  try {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
    return true;
  } catch {
    return false;
  }
};

const isCustomer = (c: any): c is Customer =>
  c && typeof c === 'object' &&
  typeof c.id === 'string' && typeof c.name === 'string' && typeof c.company === 'string' &&
  Object.values(CustomerStatus).includes(c.status) && Array.isArray(c.interactions);

/** Parses and validates a JSON customer list; returns null when invalid. */
export const parseCustomers = (json: string): Customer[] | null => {
  try {
    const data = JSON.parse(json);
    const list = Array.isArray(data) ? data : data?.customers;
    if (!Array.isArray(list) || !list.every(isCustomer)) return null;
    return list.map((c: Customer) => ({
      ...c,
      email: c.email ?? '',
      lastContact: c.lastContact ?? '',
      interactions: c.interactions.filter(i => Object.values(InteractionType).includes(i.type)),
    }));
  } catch {
    return null;
  }
};

export const exportJSON = (customers: Customer[]) =>
  JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), customers }, null, 2);

const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportCSV = (customers: Customer[]) => {
  const header = ['Name', 'Company', 'Email', 'Status', 'Deal Value', 'Last Contact', 'Next Action', 'Due Date', 'Key Contacts', 'Pain Points', 'Competitors', 'Closed Reason', 'Interactions'];
  const rows = customers.map(c => [
    c.name, c.company, c.email, c.status, c.dealValue ?? '', c.lastContact,
    c.nextAction?.description ?? '', c.nextAction?.dueDate ?? '',
    (c.keyContacts ?? []).map(k => `${k.name} (${k.title})`).join('; '),
    (c.customerPainPoints ?? []).join('; '), (c.competitors ?? []).join('; '),
    c.closedReason ?? '', c.interactions.length,
  ].map(csvCell).join(','));
  // BOM so Excel opens UTF-8 (Chinese) correctly.
  return '﻿' + [header.join(','), ...rows].join('\n');
};

export const downloadFile = (filename: string, content: string, mime: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
