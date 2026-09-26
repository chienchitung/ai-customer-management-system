import { Customer, CustomerStatus, InteractionType } from '../types';
import { addDays, daysBetween } from './dates';

// Pure business logic for the Today workbench and the analytics dashboard.

export const STALE_DAYS = 14;

export const isOpen = (c: Customer) =>
  c.status !== CustomerStatus.CLOSED_WON && c.status !== CustomerStatus.CLOSED_LOST;

// Default win probability per stage, used for the weighted forecast.
export const STAGE_PROBABILITY: Record<CustomerStatus, number> = {
  [CustomerStatus.LEAD]: 0.1,
  [CustomerStatus.PROSPECT]: 0.3,
  [CustomerStatus.NEGOTIATION]: 0.6,
  [CustomerStatus.CLOSED_WON]: 1,
  [CustomerStatus.CLOSED_LOST]: 0,
};

export type TaskKind = 'overdue' | 'dueToday' | 'stale' | 'noNextAction' | 'upcoming';

export interface WorkItem {
  customer: Customer;
  kind: TaskKind;
  /** Days overdue (overdue), days since last contact (stale), days until due (upcoming). */
  days: number;
  score: number;
}

const KIND_WEIGHT: Record<TaskKind, number> = { overdue: 4, dueToday: 3, stale: 2, noNextAction: 1, upcoming: 0 };

/** Builds today's prioritized work list. Each open customer appears at most once, under its most urgent reason. */
export const buildWorkList = (customers: Customer[], today: string, upcomingWindow = 7): WorkItem[] => {
  const items: WorkItem[] = [];
  for (const c of customers.filter(isOpen)) {
    const due = c.nextAction?.dueDate;
    const sinceContact = c.lastContact ? daysBetween(c.lastContact, today) : Infinity;
    let item: Omit<WorkItem, 'score'> | null = null;
    if (c.nextAction && due && due < today) item = { customer: c, kind: 'overdue', days: daysBetween(due, today) };
    else if (c.nextAction && due === today) item = { customer: c, kind: 'dueToday', days: 0 };
    else if (sinceContact >= STALE_DAYS) item = { customer: c, kind: 'stale', days: sinceContact };
    else if (!c.nextAction) item = { customer: c, kind: 'noNextAction', days: 0 };
    else if (due && due <= addDays(today, upcomingWindow)) item = { customer: c, kind: 'upcoming', days: daysBetween(today, due) };
    if (!item) continue;
    // Urgency first, then money at stake (weighted by stage), then how late it is.
    const value = (c.dealValue ?? 0) * STAGE_PROBABILITY[c.status];
    items.push({ ...item, score: KIND_WEIGHT[item.kind] * 1e9 + value + Math.min(item.days, 365) });
  }
  return items.sort((a, b) => b.score - a.score);
};

export interface PipelineMetrics {
  openCount: number;
  pipelineValue: number;
  weightedForecast: number;
  wonValue: number;
  winRate: number | null; // won / (won + lost)
  avgDealValue: number;
  /** Share of customers that reached at least stage i and went on to stage i+1. */
  stageConversion: { from: CustomerStatus; to: CustomerStatus; rate: number | null }[];
  avgDaysInStage: { status: CustomerStatus; days: number | null }[];
  activityByWeek: { weekStart: string; counts: Record<InteractionType, number> }[];
  closedReasons: { status: CustomerStatus; company: string; reason: string }[];
}

const FUNNEL = [CustomerStatus.LEAD, CustomerStatus.PROSPECT, CustomerStatus.NEGOTIATION, CustomerStatus.CLOSED_WON];

const stageRank = (s: CustomerStatus) => FUNNEL.indexOf(s);

/** Highest funnel stage a customer reached (lost deals count their last open stage). */
const furthestStage = (c: Customer) => {
  const seen = [c.status, ...(c.statusHistory ?? []).map(h => h.status)].map(stageRank).filter(r => r >= 0);
  // A lost deal with no history is assumed to have reached at least Lead.
  return seen.length ? Math.max(...seen) : 0;
};

const mondayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const offset = (date.getDay() + 6) % 7;
  return addDays(iso, -offset);
};

export const computeMetrics = (customers: Customer[], today: string, weeks = 8): PipelineMetrics => {
  const open = customers.filter(isOpen);
  const won = customers.filter(c => c.status === CustomerStatus.CLOSED_WON);
  const lost = customers.filter(c => c.status === CustomerStatus.CLOSED_LOST);
  const withValue = customers.filter(c => typeof c.dealValue === 'number');

  const stageConversion = FUNNEL.slice(0, -1).map((from, i) => {
    const reached = customers.filter(c => furthestStage(c) >= i);
    const advanced = reached.filter(c => furthestStage(c) >= i + 1);
    // Customers still sitting (open) in this stage haven't had a chance to convert yet.
    const decided = reached.filter(c => !(isOpen(c) && stageRank(c.status) === i));
    return { from, to: FUNNEL[i + 1], rate: decided.length ? advanced.length / decided.length : null };
  });

  const stageDurations = new Map<CustomerStatus, number[]>();
  for (const c of customers) {
    const h = c.statusHistory ?? [];
    h.forEach((entry, i) => {
      const end = h[i + 1]?.date ?? (isOpen(c) ? today : null);
      if (!end || !isOpen({ ...c, status: entry.status })) return;
      const list = stageDurations.get(entry.status) ?? [];
      list.push(daysBetween(entry.date, end));
      stageDurations.set(entry.status, list);
    });
  }

  const thisWeek = mondayOf(today);
  const activityByWeek = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(thisWeek, -7 * (weeks - 1 - i));
    const counts = Object.fromEntries(Object.values(InteractionType).map(t => [t, 0])) as Record<InteractionType, number>;
    return { weekStart, counts };
  });
  for (const c of customers) {
    for (const it of c.interactions) {
      const bucket = activityByWeek.find(w => w.weekStart === mondayOf(it.date));
      if (bucket) bucket.counts[it.type]++;
    }
  }

  return {
    openCount: open.length,
    pipelineValue: open.reduce((s, c) => s + (c.dealValue ?? 0), 0),
    weightedForecast: open.reduce((s, c) => s + (c.dealValue ?? 0) * STAGE_PROBABILITY[c.status], 0),
    wonValue: won.reduce((s, c) => s + (c.dealValue ?? 0), 0),
    winRate: won.length + lost.length ? won.length / (won.length + lost.length) : null,
    avgDealValue: withValue.length ? withValue.reduce((s, c) => s + (c.dealValue ?? 0), 0) / withValue.length : 0,
    stageConversion,
    avgDaysInStage: FUNNEL.slice(0, -1).map(status => {
      const list = stageDurations.get(status);
      return { status, days: list?.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null };
    }),
    activityByWeek,
    closedReasons: [...won, ...lost]
      .filter(c => c.closedReason)
      .map(c => ({ status: c.status, company: c.company, reason: c.closedReason! })),
  };
};

/** Applies a status change, recording history and prompting-free bookkeeping. */
export const withStatus = (c: Customer, status: CustomerStatus, today: string): Customer => {
  if (c.status === status) return c;
  const history = c.statusHistory?.length ? c.statusHistory : [{ status: c.status, date: c.createdAt ?? c.lastContact ?? today }];
  return { ...c, status, statusHistory: [...history, { status, date: today }] };
};
