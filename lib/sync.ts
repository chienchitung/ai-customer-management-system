import { Customer } from '../types';

// Computes the minimal set of writes between the last synced state and the current state.

export type Snapshot = Map<string, string>;

export const snapshotOf = (customers: Customer[]): Snapshot =>
  new Map(customers.map(c => [c.id, JSON.stringify(c)]));

export const diffCustomers = (synced: Snapshot, current: Customer[]) => {
  const currentIds = new Set(current.map(c => c.id));
  const upserts = current.filter(c => synced.get(c.id) !== JSON.stringify(c));
  const deletes = [...synced.keys()].filter(id => !currentIds.has(id));
  return { upserts, deletes };
};
