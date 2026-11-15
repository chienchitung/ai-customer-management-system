import { Customer, CustomerStatus, InteractionType } from '../types';
import { withStatus } from './insights';
import { generateId } from './ids';

// The document agent: ComPDF turns a file into text, the model reads it, and these pure
// functions decide what that means for the CRM. Nothing here changes data on its own;
// the dialog shows every proposed change and the user picks which ones to apply.

export const DOCUMENT_KINDS = ['quote_request', 'quote', 'purchase_order', 'contract', 'invoice', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface DocumentAnalysis {
  documentType: DocumentKind;
  title: string;
  summary: string;
  counterpartyName: string;
  counterpartyCompany: string;
  counterpartyEmail: string;
  /** Id from the customer list given to the model, or '' when it found no match. */
  matchedCustomerId: string;
  amount?: number;
  currency?: string;
  keyDates?: { label: string; date: string }[];
  suggestedStatus?: string;
  nextActionDescription?: string;
  nextActionDueDate?: string;
  newPainPoints?: string[];
  newCompetitors?: string[];
  /** Clauses or terms the rep should check before acting (payment terms, penalties, renewals). */
  watchItems?: string[];
}

export type MatchReason = 'email' | 'ai' | 'company';

const normCompany = (s: string) =>
  s.toLowerCase()
    .replace(/股份有限公司|有限公司|公司|\b(inc|corp|corporation|co|ltd|llc|limited|gmbh|plc)\b\.?/g, '')
    .replace(/[\s.,()（）&-]+/g, '');

/** Picks the customer a document belongs to. An exact email beats the model's guess, which beats a company-name match. */
export const matchCustomer = (a: DocumentAnalysis, customers: Customer[]): { customerId: string; reason: MatchReason } | null => {
  const email = a.counterpartyEmail.trim().toLowerCase();
  if (email) {
    const byEmail = customers.find(c => c.email.trim().toLowerCase() === email);
    if (byEmail) return { customerId: byEmail.id, reason: 'email' };
  }
  if (a.matchedCustomerId && customers.some(c => c.id === a.matchedCustomerId)) {
    return { customerId: a.matchedCustomerId, reason: 'ai' };
  }
  const company = normCompany(a.counterpartyCompany);
  if (company.length >= 2) {
    const byCompany = customers.filter(c => normCompany(c.company) === company);
    if (byCompany.length === 1) return { customerId: byCompany[0].id, reason: 'company' };
  }
  return null;
};

export type ChangeKey = 'dealValue' | 'status' | 'nextAction' | 'painPoints' | 'competitors';

export interface ProposedChange {
  key: ChangeKey;
  from: string;
  to: string;
}

const STAGE_ORDER = [CustomerStatus.LEAD, CustomerStatus.PROSPECT, CustomerStatus.NEGOTIATION, CustomerStatus.CLOSED_WON];
const isISODate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const newItems = (existing: string[] | undefined, incoming: string[] | undefined) => {
  const seen = new Set((existing ?? []).map(s => s.trim().toLowerCase()));
  return (incoming ?? []).map(s => s.trim()).filter(s => s && !seen.has(s.toLowerCase()));
};

/**
 * Lists the changes a document implies for a customer. The stage only moves forward, and never
 * to Closed (Lost): a document alone is not enough evidence to lose a deal.
 */
export const proposeChanges = (customer: Customer, a: DocumentAnalysis, today: string): ProposedChange[] => {
  const changes: ProposedChange[] = [];
  if (a.amount && a.amount > 0 && a.amount !== customer.dealValue) {
    const currency = (a.currency || customer.dealCurrency || 'USD').toUpperCase();
    changes.push({
      key: 'dealValue',
      from: customer.dealValue ? `${customer.dealCurrency || 'USD'} ${customer.dealValue.toLocaleString('en-US')}` : '',
      to: `${currency} ${a.amount.toLocaleString('en-US')}`,
    });
  }
  const target = STAGE_ORDER.find(s => s === a.suggestedStatus);
  const current = STAGE_ORDER.indexOf(customer.status);
  if (target && current !== -1 && STAGE_ORDER.indexOf(target) > current) {
    changes.push({ key: 'status', from: customer.status, to: target });
  }
  if (a.nextActionDescription?.trim()) {
    const due = isISODate(a.nextActionDueDate) && a.nextActionDueDate! >= today ? a.nextActionDueDate! : today;
    changes.push({ key: 'nextAction', from: customer.nextAction?.description ?? '', to: `${a.nextActionDescription.trim()} (${due})` });
  }
  const pains = newItems(customer.customerPainPoints, a.newPainPoints);
  if (pains.length) changes.push({ key: 'painPoints', from: '', to: pains.join('; ') });
  const rivals = newItems(customer.competitors, a.newCompetitors);
  if (rivals.length) changes.push({ key: 'competitors', from: '', to: rivals.join('; ') });
  return changes;
};

/** One interaction-log line for the document, so the history shows what was read and what to watch. */
export const documentLogText = (a: DocumentAnalysis, fileName: string, typeLabel: string, watchLabel: string) => {
  const head = `${typeLabel}「${a.title || fileName}」(${fileName})`;
  const watch = (a.watchItems ?? []).filter(Boolean);
  return `${head}: ${a.summary.trim()}${watch.length ? `\n${watchLabel}: ${watch.join('; ')}` : ''}`;
};

/** Applies the selected changes and logs the document as a note. */
export const applyDocument = (
  customer: Customer,
  a: DocumentAnalysis,
  selected: ChangeKey[],
  logText: string,
  today: string,
): Customer => {
  const pick = new Set(selected);
  let c: Customer = { ...customer };
  if (pick.has('dealValue') && a.amount && a.amount > 0) {
    c.dealValue = a.amount;
    c.dealCurrency = (a.currency || customer.dealCurrency || 'USD').toUpperCase();
  }
  if (pick.has('status')) {
    const target = STAGE_ORDER.find(s => s === a.suggestedStatus);
    if (target) c = withStatus(c, target, today);
    // The win/loss panel on the dashboard reads closedReason; the document is the evidence.
    if (target === CustomerStatus.CLOSED_WON && !c.closedReason) c.closedReason = a.title || a.summary;
  }
  if (pick.has('nextAction') && a.nextActionDescription?.trim()) {
    const due = isISODate(a.nextActionDueDate) && a.nextActionDueDate! >= today ? a.nextActionDueDate! : today;
    c.nextAction = { description: a.nextActionDescription.trim(), dueDate: due };
  }
  if (pick.has('painPoints')) c.customerPainPoints = [...(c.customerPainPoints ?? []), ...newItems(c.customerPainPoints, a.newPainPoints)];
  if (pick.has('competitors')) c.competitors = [...(c.competitors ?? []), ...newItems(c.competitors, a.newCompetitors)];
  c.interactions = [{ id: generateId(), type: InteractionType.NOTE, date: today, summary: logText }, ...c.interactions];
  c.lastContact = !c.lastContact || today > c.lastContact ? today : c.lastContact;
  return c;
};

/** Prefill for the new-customer form when the document is from someone not in the CRM yet. */
export const prefillFromDocument = (a: DocumentAnalysis, today: string): Partial<Customer> => ({
  name: a.counterpartyName || a.counterpartyCompany,
  company: a.counterpartyCompany || a.counterpartyName,
  email: a.counterpartyEmail,
  dealValue: a.amount && a.amount > 0 ? a.amount : undefined,
  dealCurrency: a.amount && a.amount > 0 ? (a.currency || 'USD').toUpperCase() : undefined,
  customerPainPoints: a.newPainPoints ?? [],
  competitors: a.newCompetitors ?? [],
  nextAction: a.nextActionDescription?.trim()
    ? { description: a.nextActionDescription.trim(), dueDate: isISODate(a.nextActionDueDate) && a.nextActionDueDate! >= today ? a.nextActionDueDate! : today }
    : undefined,
});
