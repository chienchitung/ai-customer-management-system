import { Customer, CustomerStatus } from '../types';
import { supabase } from './supabase';

// Maps Customer objects to rows of public.customers (see supabase/migrations).

export interface CustomerRow {
  id: string;
  name: string;
  company: string;
  email: string;
  status: CustomerStatus;
  deal_value: number | null;
  deal_currency?: string;
  last_contact: string | null;
  next_action: Customer['nextAction'] | null;
  key_contacts: NonNullable<Customer['keyContacts']>;
  pain_points: string[];
  competitors: string[];
  closed_reason: string | null;
  status_history: NonNullable<Customer['statusHistory']>;
  interactions: Customer['interactions'];
  created_at?: string;
}

export const toRow = (c: Customer): CustomerRow => ({
  id: c.id,
  name: c.name,
  company: c.company,
  email: c.email ?? '',
  status: c.status,
  deal_value: typeof c.dealValue === 'number' ? c.dealValue : null,
  deal_currency: c.dealCurrency || 'USD',
  last_contact: c.lastContact || null,
  next_action: c.nextAction ?? null,
  key_contacts: c.keyContacts ?? [],
  pain_points: c.customerPainPoints ?? [],
  competitors: c.competitors ?? [],
  closed_reason: c.closedReason ?? null,
  status_history: c.statusHistory ?? [],
  interactions: c.interactions,
  ...(c.createdAt ? { created_at: c.createdAt } : {}),
});

export const fromRow = (r: CustomerRow): Customer => ({
  id: r.id,
  name: r.name,
  company: r.company,
  email: r.email ?? '',
  status: r.status,
  dealValue: r.deal_value === null || r.deal_value === undefined ? undefined : Number(r.deal_value),
  dealCurrency: r.deal_currency || 'USD',
  lastContact: r.last_contact ?? '',
  nextAction: r.next_action ?? undefined,
  keyContacts: r.key_contacts ?? [],
  customerPainPoints: r.pain_points ?? [],
  competitors: r.competitors ?? [],
  closedReason: r.closed_reason ?? undefined,
  statusHistory: r.status_history ?? [],
  interactions: r.interactions ?? [],
  createdAt: r.created_at,
});

const COLUMNS = 'id,name,company,email,status,deal_value,deal_currency,last_contact,next_action,key_contacts,pain_points,competitors,closed_reason,status_history,interactions,created_at';

export const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase!.from('customers').select(COLUMNS).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as CustomerRow[]).map(fromRow);
};

export const upsertCustomers = async (customers: Customer[]) => {
  if (!customers.length) return;
  const { error } = await supabase!.from('customers').upsert(customers.map(toRow), { onConflict: 'owner_id,id', defaultToNull: false });
  if (error) throw error;
};

export const deleteCustomers = async (ids: string[]) => {
  if (!ids.length) return;
  const { error } = await supabase!.from('customers').delete().in('id', ids);
  if (error) throw error;
};
