import { Customer, CustomerStatus, InteractionType } from '../types';
import { CURRENCIES } from './currency';
import { generateId } from './ids';
import { todayISO } from './dates';

// CSV import: parse (RFC 4180), map flexible English/Chinese headers to
// customer fields, validate rows and skip duplicates of existing customers.

/** Parses CSV text into rows of cells. Handles quotes, escaped quotes, CRLF and a UTF-8 BOM. */
export const parseCsv = (text: string): string[][] => {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
};

type Field = 'name' | 'company' | 'email' | 'status' | 'dealValue' | 'currency' | 'lastContact' | 'nextAction' | 'dueDate' | 'painPoints' | 'competitors' | 'closedReason' | 'notes';

const HEADER_ALIASES: Record<Field, string[]> = {
  name: ['name', 'full name', 'contact', 'contact name', '姓名', '名稱', '客戶', '客戶名稱', '聯絡人', '全名'],
  company: ['company', 'company name', 'organization', 'account', '公司', '公司名稱', '企業', '組織'],
  email: ['email', 'e-mail', 'email address', '電子郵件', '電子郵件地址', '信箱', 'email 地址'],
  status: ['status', 'stage', 'deal stage', '階段', '商機階段', '狀態'],
  dealValue: ['deal value', 'amount', 'value', 'deal amount', '金額', '交易金額', '交易價值'],
  currency: ['currency', 'deal currency', '幣別', '原幣', '交易原幣'],
  lastContact: ['last contact', 'last contacted', '最後聯絡', '上次聯絡'],
  nextAction: ['next action', 'next step', '下一步', '下一步行動'],
  dueDate: ['due date', 'next action due', '到期日', '截止日期', '下一步到期日'],
  painPoints: ['pain points', 'pain point', '痛點', '客戶痛點'],
  competitors: ['competitors', 'competitor', '競爭對手'],
  closedReason: ['closed reason', 'close reason', '結案原因', '成交原因', '流失原因'],
  notes: ['notes', 'note', 'remarks', '備註', '筆記', '說明'],
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const STATUS_ALIASES: Record<string, CustomerStatus> = {
  lead: CustomerStatus.LEAD, '銷售線索': CustomerStatus.LEAD, '線索': CustomerStatus.LEAD, '潛在客戶': CustomerStatus.PROSPECT,
  prospect: CustomerStatus.PROSPECT, negotiation: CustomerStatus.NEGOTIATION, '談判中': CustomerStatus.NEGOTIATION, '議價': CustomerStatus.NEGOTIATION,
  'closed (won)': CustomerStatus.CLOSED_WON, won: CustomerStatus.CLOSED_WON, '已成交': CustomerStatus.CLOSED_WON, '成交': CustomerStatus.CLOSED_WON,
  'closed (lost)': CustomerStatus.CLOSED_LOST, lost: CustomerStatus.CLOSED_LOST, '已流失': CustomerStatus.CLOSED_LOST, '流失': CustomerStatus.CLOSED_LOST,
};

/** 'YYYY-MM-DD' or 'YYYY/M/D' -> 'YYYY-MM-DD'; anything else -> null. */
const parseDate = (raw: string): string | null => {
  const m = raw.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

export type RowIssue = { row: number; reason: 'missingName' | 'missingCompany' | 'badEmail' | 'badAmount' | 'badDate' | 'duplicate' | 'duplicateInFile'; detail?: string };

export interface ImportPreview {
  /** Header fields that were recognised, in column order (null = ignored column). */
  mapping: (Field | null)[];
  customers: Customer[];
  issues: RowIssue[];
  totalRows: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const key = (name: string, company: string) => `${normalize(name)}|${normalize(company)}`;

export const buildImport = (text: string, existing: Customer[], today = todayISO()): ImportPreview => {
  const rows = parseCsv(text);
  if (rows.length === 0) return { mapping: [], customers: [], issues: [], totalRows: 0 };
  const mapping = rows[0].map(h => {
    const n = normalize(h);
    return (Object.keys(HEADER_ALIASES) as Field[]).find(f => HEADER_ALIASES[f].includes(n)) ?? null;
  });
  const col = (row: string[], f: Field) => { const i = mapping.indexOf(f); return i >= 0 ? (row[i] ?? '').trim() : ''; };
  const list = (v: string) => v.split(/[;；、\n]/).map(x => x.trim()).filter(Boolean);

  const existingEmails = new Set(existing.map(c => c.email.trim().toLowerCase()).filter(Boolean));
  const existingKeys = new Set(existing.map(c => key(c.name, c.company)));
  const seenEmails = new Set<string>();
  const seenKeys = new Set<string>();
  const customers: Customer[] = [];
  const issues: RowIssue[] = [];

  rows.slice(1).forEach((row, idx) => {
    const rowNo = idx + 2; // 1-based, counting the header row
    const name = col(row, 'name');
    const company = col(row, 'company');
    const email = col(row, 'email');
    if (!name) return issues.push({ row: rowNo, reason: 'missingName' });
    if (!company) return issues.push({ row: rowNo, reason: 'missingCompany', detail: name });
    if (email && !EMAIL_RE.test(email)) return issues.push({ row: rowNo, reason: 'badEmail', detail: email });

    const rawAmount = col(row, 'dealValue').replace(/[,\s$]/g, '');
    const amount = rawAmount === '' ? undefined : Number(rawAmount);
    if (amount !== undefined && !(amount >= 0)) return issues.push({ row: rowNo, reason: 'badAmount', detail: col(row, 'dealValue') });

    const rawDue = col(row, 'dueDate');
    const due = rawDue ? parseDate(rawDue) : null;
    if (rawDue && !due) return issues.push({ row: rowNo, reason: 'badDate', detail: rawDue });
    const rawLast = col(row, 'lastContact');
    const last = rawLast ? parseDate(rawLast) : null;
    if (rawLast && !last) return issues.push({ row: rowNo, reason: 'badDate', detail: rawLast });

    const emailKey = email.toLowerCase();
    const nameKey = key(name, company);
    if ((emailKey && existingEmails.has(emailKey)) || existingKeys.has(nameKey)) return issues.push({ row: rowNo, reason: 'duplicate', detail: name });
    if ((emailKey && seenEmails.has(emailKey)) || seenKeys.has(nameKey)) return issues.push({ row: rowNo, reason: 'duplicateInFile', detail: name });
    if (emailKey) seenEmails.add(emailKey);
    seenKeys.add(nameKey);

    const status = STATUS_ALIASES[normalize(col(row, 'status'))] ?? CustomerStatus.LEAD;
    const currency = col(row, 'currency').toUpperCase();
    const notes = col(row, 'notes');
    const nextAction = col(row, 'nextAction');
    const created = last ?? today;
    customers.push({
      id: generateId(),
      name, company, email, status,
      dealValue: amount,
      dealCurrency: (CURRENCIES as readonly string[]).includes(currency) ? currency : 'USD',
      lastContact: created,
      createdAt: today,
      statusHistory: [{ status, date: today }],
      nextAction: nextAction ? { description: nextAction, dueDate: due ?? '' } : undefined,
      customerPainPoints: list(col(row, 'painPoints')),
      competitors: list(col(row, 'competitors')),
      closedReason: col(row, 'closedReason') || undefined,
      keyContacts: [],
      interactions: notes ? [{ id: generateId(), type: InteractionType.NOTE, date: created, summary: notes }] : [],
    } as Customer);
  });

  return { mapping, customers, issues, totalRows: rows.length - 1 };
};

/** A ready-to-fill template with the recognised headers. */
export const csvTemplate = (language: 'en' | 'zh') =>
  '\uFEFF' + (language === 'zh'
    ? '姓名,公司,Email,商機階段,交易金額,幣別,下一步行動,到期日,備註\n王小明,範例科技,ming@example.com,潛在客戶,50000,TWD,寄送報價,2026-10-15,展會認識\n'
    : 'Name,Company,Email,Status,Deal Value,Currency,Next Action,Due Date,Notes\nJane Doe,Example Inc,jane@example.com,Prospect,50000,USD,Send quote,2026-10-15,Met at trade show\n');
