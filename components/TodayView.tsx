import { DealAmount, useCurrency } from './Currency';
import { convertMoney, formatMoney } from '../lib/currency';
import React, { useMemo, useState } from 'react';
import { Customer, NextAction } from '../types';
import { t, tf } from '../localization';
import { buildWorkList, computeMetrics, TaskKind, WorkItem } from '../lib/insights';
import { addDays, todayISO } from '../lib/dates';
import { getCachedProactiveSummary, getProactiveSummary } from '../services/geminiService';
import { Avatar, StatusBadge } from './ui';
import { formatDate } from '../lib/format';
import { aiErrorMessage } from './Dialogs';
import { CheckIcon, SparklesIcon } from './icons';

type Language = 'en' | 'zh';

const GROUP_LIMIT = 5;

interface TodayViewProps {
  customers: Customer[];
  language: Language;
  onOpenCustomer: (id: string) => void;
  onComplete: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onSetNextAction: (id: string, action: NextAction) => void;
}



const TodayView: React.FC<TodayViewProps> = ({ customers, language, onOpenCustomer, onComplete, onSnooze, onSetNextAction }) => {
  const today = todayISO();
  const items = useMemo(() => buildWorkList(customers, today), [customers, today]);
  const fx = useCurrency();
  const missing = customers.some(c => c.dealValue != null && convertMoney(c.dealValue, c.dealCurrency || 'USD', fx.currency, fx.rates) == null);
  const metrics = useMemo(() => computeMetrics(customers.map(c => ({ ...c, dealValue: c.dealValue == null ? undefined : convertMoney(c.dealValue, c.dealCurrency || 'USD', fx.currency, fx.rates) ?? undefined })), today), [customers, today, fx.currency, fx.rates]);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<TaskKind>>(new Set());
  const [loadingHints, setLoadingHints] = useState(false);

  const count = (kind: TaskKind) => items.filter(i => i.kind === kind).length;

  const loadHints = async () => {
    setLoadingHints(true);
    const top = items.slice(0, 5);
    // Sequential to stay friendly to the rate limit; results are cached per customer state.
    for (const item of top) {
      try {
        const text = await getProactiveSummary(item.customer, language);
        setHints(h => ({ ...h, [item.customer.id]: text }));
      } catch (e) {
        setHints(h => ({ ...h, [item.customer.id]: aiErrorMessage(e, language) }));
        break;
      }
    }
    setLoadingHints(false);
  };

  const reason = (item: WorkItem) => {
    switch (item.kind) {
      case 'overdue': return tf('todayView.daysOverdue', language, { n: item.days });
      case 'stale': return tf('todayView.daysSince', language, { n: item.days });
      case 'upcoming': return tf('todayView.inDays', language, { n: item.days });
      default: return t(`todayView.${item.kind}`, language);
    }
  };

  const GROUPS: TaskKind[] = ['overdue', 'dueToday', 'stale', 'noNextAction', 'upcoming'];
  const DOT: Record<TaskKind, string> = {
    overdue: 'bg-rose-500', dueToday: 'bg-amber-500', stale: 'bg-sky-500', noNextAction: 'bg-zinc-400', upcoming: 'bg-emerald-500',
  };
  const REASON_TONE: Record<TaskKind, string> = {
    overdue: 'text-rose-600 dark:text-rose-400', dueToday: 'text-amber-700 dark:text-amber-400', stale: 'text-sky-700 dark:text-sky-400',
    noNextAction: 'text-text-secondary', upcoming: 'text-emerald-700 dark:text-emerald-400',
  };

  const stat = (label: string, value: string | number, dot?: string) => (
    <div className="card metric-card px-4 sm:px-5 py-4 min-w-0">
      <p className="text-xs text-text-secondary flex items-center gap-1.5">{dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}{label}</p>
      <p className="text-base sm:text-xl xl:text-2xl font-bold tracking-tight mt-1 tabular-nums">{value}</p>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto -mx-4 md:-mx-6 px-4 md:px-6">
      <div className="max-w-6xl mx-auto space-y-7 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
          <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary mb-1">{language === 'zh' ? '每日焦點' : 'Daily focus'}</p><p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{formatDate(today, language)}</span> · {t('todayView.subtitle', language)}
          </p></div>
          {items.length > 0 && (
            <button onClick={loadHints} disabled={loadingHints} className="btn btn-secondary">
              <SparklesIcon className="w-4 h-4 text-primary" />
              {loadingHints ? t('generating', language) : t('todayView.aiHintLoad', language)}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stat(t('todayView.statOverdue', language), count('overdue'), DOT.overdue)}
          {stat(t('todayView.statToday', language), count('dueToday'), DOT.dueToday)}
          {stat(t('todayView.statStale', language), count('stale'), DOT.stale)}
          {stat(t('todayView.statForecast', language), missing ? '—' : formatMoney(metrics.weightedForecast, fx.currency))}
        </div>

        {items.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckIcon className="w-8 h-8 mx-auto text-emerald-500" />
            <p className="mt-3 text-sm text-text-secondary">{t('todayView.allClear', language)}</p>
          </div>
        ) : GROUPS.map(kind => {
          const group = items.filter(i => i.kind === kind);
          if (!group.length) return null;
          // Long groups are capped so the list stays a short, actionable to-do list.
          const isExpanded = expanded.has(kind);
          const visible = isExpanded ? group : group.slice(0, GROUP_LIMIT);
          return (
            <section key={kind} aria-label={t(`todayView.${kind}`, language)}>
              <h2 className="flex items-center gap-2 mb-2 text-xs font-medium text-text-secondary">
                <span className={`w-1.5 h-1.5 rounded-full ${DOT[kind]}`} />
                {t(`todayView.${kind}`, language)}
                <span className="tabular-nums">{group.length}</span>
              </h2>
              <ul className="card divide-y divide-border overflow-hidden shadow-sm">
                {visible.map(item => {
                  const c = item.customer;
                  const hint = hints[c.id] ?? getCachedProactiveSummary(c, language);
                  return (
                    <li key={c.id} className="group flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors">
                      <button onClick={() => onOpenCustomer(c.id)} className="flex items-start gap-3 flex-grow min-w-0 text-left">
                        <Avatar name={c.name} />
                        <span className="min-w-0 flex-grow">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">{c.name}</span>
                            <span className="text-sm text-text-secondary">{c.company}</span>
                            <StatusBadge status={c.status} language={language} />
                          </span>
                          <span className="flex flex-wrap items-center gap-x-1.5 mt-0.5 text-xs text-text-secondary">
                            <span className={`font-medium ${REASON_TONE[item.kind]}`}>{reason(item)}</span>
                            {c.nextAction && <><span aria-hidden="true">·</span><span className="truncate max-w-[28rem]">{c.nextAction.description}</span></>}
                            {c.nextAction?.dueDate && <span className="whitespace-nowrap">· {formatDate(c.nextAction.dueDate, language)}</span>}
                          </span>
                          {hint && (
                            <span className="flex gap-1.5 mt-1.5 text-xs text-text-primary">
                              <SparklesIcon className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-px" />
                              <span>{hint.replace(/\*\*/g, '')}</span>
                            </span>
                          )}
                        </span>
                      </button>
                      <div className="flex items-center gap-3 flex-shrink-0 pl-11 lg:pl-0">
                        {c.dealValue ? <span className="text-sm font-medium tabular-nums flex-shrink-0 hidden md:block lg:min-w-[150px] lg:text-right"><DealAmount customer={c} /></span> : <span className="hidden lg:block lg:min-w-[150px]" />}
                        {/* Fixed width keeps the amount column aligned whichever actions a row has. */}
                        <div className="flex items-center justify-end gap-1.5 lg:w-[12rem]">
                        {c.nextAction ? (
                          <>
                            <button onClick={() => onSnooze(c.id, 1)} className="btn btn-ghost btn-sm">{t('todayView.snooze', language)}</button>
                            <button onClick={() => onComplete(c.id)} className="btn btn-secondary btn-sm"><CheckIcon className="w-3.5 h-3.5" />{t('todayView.complete', language)}</button>
                          </>
                        ) : (
                          <button
                            onClick={() => onSetNextAction(c.id, { description: tf('todayView.defaultAction', language, { name: c.name }), dueDate: addDays(today, 1) })}
                            className="btn btn-secondary btn-sm"
                          >
                            {t('todayView.setAction', language)}
                          </button>
                        )}
                        <button onClick={() => onOpenCustomer(c.id)} className="btn btn-ghost btn-sm">{t('todayView.open', language)}</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {group.length > GROUP_LIMIT && (
                <button
                  onClick={() => setExpanded(prev => { const next = new Set(prev); if (next.has(kind)) next.delete(kind); else next.add(kind); return next; })}
                  aria-expanded={isExpanded}
                  className="btn btn-ghost btn-sm mt-1 text-text-secondary"
                >
                  {isExpanded ? t('todayView.showLess', language) : tf('todayView.showAll', language, { n: group.length })}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default TodayView;
