import { describe, it, expect } from 'vitest';
import { Customer, CustomerStatus, InteractionType } from '../types';
import { buildWorkList, computeMetrics, withStatus } from '../lib/insights';
import { addDays, daysBetween } from '../lib/dates';
import { exportCSV, exportJSON, parseCustomers } from '../lib/storage';

const TODAY = '2024-08-10';
const base = (over: Partial<Customer>): Customer => ({
  id: Math.random().toString(), name: 'N', company: 'C', email: 'e@x.com',
  status: CustomerStatus.PROSPECT, lastContact: TODAY, interactions: [], ...over,
});

describe('dates', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
  });
});

describe('buildWorkList', () => {
  it('prioritizes overdue > due today > stale > no next action and skips closed deals', () => {
    const list = buildWorkList([
      base({ id: 'none', nextAction: undefined }),
      base({ id: 'stale', lastContact: '2024-07-01', nextAction: { description: 'x', dueDate: '2024-09-01' } }),
      base({ id: 'today', nextAction: { description: 'x', dueDate: TODAY } }),
      base({ id: 'late', nextAction: { description: 'x', dueDate: '2024-08-05' } }),
      base({ id: 'won', status: CustomerStatus.CLOSED_WON, nextAction: { description: 'x', dueDate: '2024-01-01' } }),
      base({ id: 'fine', nextAction: { description: 'x', dueDate: '2024-12-01' } }),
    ], TODAY);
    expect(list.map(i => i.customer.id)).toEqual(['late', 'today', 'stale', 'none']);
    expect(list[0].days).toBe(5);
    expect(list[2].days).toBe(40);
  });

  it('ranks by weighted value within the same urgency', () => {
    const list = buildWorkList([
      base({ id: 'small', dealValue: 1000, nextAction: { description: 'x', dueDate: TODAY } }),
      base({ id: 'big', dealValue: 90000, status: CustomerStatus.NEGOTIATION, nextAction: { description: 'x', dueDate: TODAY } }),
    ], TODAY);
    expect(list[0].customer.id).toBe('big');
  });
});

describe('computeMetrics', () => {
  it('computes forecast, win rate and conversion', () => {
    const m = computeMetrics([
      base({ status: CustomerStatus.LEAD, dealValue: 100 }),
      base({ status: CustomerStatus.NEGOTIATION, dealValue: 1000 }),
      base({ status: CustomerStatus.CLOSED_WON, dealValue: 500, closedReason: 'price' }),
      base({ status: CustomerStatus.CLOSED_LOST, dealValue: 700 }),
    ], TODAY);
    expect(m.pipelineValue).toBe(1100);
    expect(m.weightedForecast).toBeCloseTo(100 * 0.1 + 1000 * 0.6);
    expect(m.winRate).toBe(0.5);
    expect(m.closedReasons).toHaveLength(1);
    // Lead -> Prospect: open lead excluded; negotiation, won advanced; lost (no history) did not.
    expect(m.stageConversion[0].rate).toBeCloseTo(2 / 3);
  });

  it('counts activity per week and stage durations from history', () => {
    const c = withStatus(base({ status: CustomerStatus.LEAD, createdAt: '2024-08-01', interactions: [
      { id: '1', type: InteractionType.CALL, date: '2024-08-09', summary: '' },
      { id: '2', type: InteractionType.EMAIL, date: '2024-06-01', summary: '' },
    ] }), CustomerStatus.PROSPECT, '2024-08-05');
    const m = computeMetrics([c], TODAY);
    expect(m.activityByWeek.at(-1)!.counts[InteractionType.CALL]).toBe(1);
    expect(m.activityByWeek.reduce((s, w) => s + w.counts[InteractionType.EMAIL], 0)).toBe(0);
    expect(m.avgDaysInStage[0].days).toBe(4);
    expect(m.avgDaysInStage[1].days).toBe(5);
  });
});

describe('storage', () => {
  it('round-trips JSON export and rejects invalid data', () => {
    const list = [base({ id: 'a' })];
    expect(parseCustomers(exportJSON(list))).toEqual(list);
    expect(parseCustomers('[{"id":1}]')).toBeNull();
    expect(parseCustomers('not json')).toBeNull();
  });

  it('escapes CSV cells', () => {
    const csv = exportCSV([base({ name: 'A, "B"' })]);
    expect(csv).toContain('"A, ""B"""');
  });
});

import { diffCustomers, snapshotOf } from '../lib/sync';
import { fromRow, toRow } from '../lib/remoteStore';

describe('sync', () => {
  it('finds changed, new and deleted customers', () => {
    const a = base({ id: 'a' }); const b = base({ id: 'b' }); const c = base({ id: 'c' });
    const snap = snapshotOf([a, b]);
    const { upserts, deletes } = diffCustomers(snap, [{ ...a, name: 'changed' }, c]);
    expect(upserts.map(x => x.id)).toEqual(['a', 'c']);
    expect(deletes).toEqual(['b']);
    expect(diffCustomers(snapshotOf([a]), [a])).toEqual({ upserts: [], deletes: [] });
  });

  it('round-trips through the database row shape', () => {
    const c = base({ id: 'r', dealValue: 5, nextAction: { description: 'x', dueDate: TODAY }, keyContacts: [{ id: 'k', name: 'K', title: 'T' }],
      customerPainPoints: ['p'], competitors: ['c'], closedReason: 'r', statusHistory: [], createdAt: TODAY });
    expect(fromRow(toRow(c))).toEqual({ ...c, dealCurrency: 'USD' });
    expect(fromRow(toRow({ ...c, dealCurrency: 'TWD' })).dealCurrency).toBe('TWD');
  });
});
