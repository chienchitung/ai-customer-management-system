import React, { useMemo, useState } from 'react';
import { Customer, NextAction } from '../types';
import { t, tf, translateStatus } from '../localization';
import { buildWorkList, computeMetrics, TaskKind, WorkItem } from '../lib/insights';
import { addDays, todayISO } from '../lib/dates';
import { getCachedProactiveSummary, getProactiveSummary } from '../services/geminiService';
import { statusColors } from './CustomerDashboard';
import { aiErrorMessage } from './Dialogs';
import { CheckIcon, SparklesIcon, CalendarIcon } from './icons';

type Language = 'en' | 'zh';

interface TodayViewProps {
  customers: Customer[];
  language: Language;
  onOpenCustomer: (id: string) => void;
  onComplete: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onSetNextAction: (id: string, action: NextAction) => void;
}

const KIND_STYLE: Record<TaskKind, string> = {
  overdue: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  dueToday: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  stale: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  noNextAction: 'bg-slate-200 text-slate-700 dark:bg-slate-600/40 dark:text-slate-200',
  upcoming: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
};

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const TodayView: React.FC<TodayViewProps> = ({ customers, language, onOpenCustomer, onComplete, onSnooze, onSetNextAction }) => {
  const today = todayISO();
  const items = useMemo(() => buildWorkList(customers, today), [customers, today]);
  const metrics = useMemo(() => computeMetrics(customers, today), [customers, today]);
  const [hints, setHints] = useState<Record<string, string>>({});
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

  const stat = (label: string, value: string | number, tone: string) => (
    <div className="bg-surface border border-border rounded-lg p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">{t('todayView.title', language)} <span className="text-base font-medium text-text-secondary">· {today}</span></h2>
            <p className="text-sm text-text-secondary mt-1">{t('todayView.subtitle', language)}</p>
          </div>
          {items.length > 0 && (
            <button onClick={loadHints} disabled={loadingHints} className="px-3 py-2 text-sm font-semibold rounded-lg border border-primary text-primary hover:bg-primary/10 transition flex items-center gap-2 disabled:opacity-50">
              <SparklesIcon className="w-4 h-4" />
              {loadingHints ? t('generating', language) : t('todayView.aiHintLoad', language)}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stat(t('todayView.statOverdue', language), count('overdue'), 'text-rose-600 dark:text-rose-400')}
          {stat(t('todayView.statToday', language), count('dueToday'), 'text-amber-600 dark:text-amber-400')}
          {stat(t('todayView.statStale', language), count('stale'), 'text-sky-600 dark:text-sky-400')}
          {stat(t('todayView.statForecast', language), money(metrics.weightedForecast), 'text-primary')}
        </div>

        {items.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-10 text-center">
            <CheckIcon className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="mt-3 text-text-secondary">{t('todayView.allClear', language)}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map(item => {
              const c = item.customer;
              const hint = hints[c.id] ?? getCachedProactiveSummary(c, language);
              return (
                <li key={c.id} className="bg-surface border border-border rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <button onClick={() => onOpenCustomer(c.id)} className="flex-grow text-left min-w-0 group">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${KIND_STYLE[item.kind]}`}>{reason(item)}</span>
                      <span className="font-semibold group-hover:text-primary transition-colors">{c.name}</span>
                      <span className="text-sm text-text-secondary">{c.company}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[c.status].bg} ${statusColors[c.status].text}`}>{translateStatus(c.status, language)}</span>
                      {c.dealValue ? <span className="text-sm font-semibold text-primary">{money(c.dealValue)}</span> : null}
                    </div>
                    {c.nextAction && (
                      <p className="text-sm mt-1 flex items-center gap-1 text-text-primary">
                        <CalendarIcon className="w-4 h-4 text-text-secondary flex-shrink-0" />
                        <span className="truncate">{c.nextAction.description}</span>
                        {c.nextAction.dueDate && <span className="text-text-secondary whitespace-nowrap">· {c.nextAction.dueDate}</span>}
                      </p>
                    )}
                    {hint && (
                      <p className="text-sm mt-1 text-text-secondary flex gap-1">
                        <SparklesIcon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{hint.replace(/\*\*/g, '')}</span>
                      </p>
                    )}
                  </button>
                  <div className="flex gap-2 flex-shrink-0">
                    {c.nextAction ? (
                      <>
                        <button onClick={() => onComplete(c.id)} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-primary text-white hover:bg-primary/90 active:scale-95 transition">{t('todayView.complete', language)}</button>
                        <button onClick={() => onSnooze(c.id, 1)} className="px-3 py-1.5 text-sm font-medium rounded-md bg-secondary hover:bg-border transition">{t('todayView.snooze', language)}</button>
                      </>
                    ) : (
                      <button
                        onClick={() => onSetNextAction(c.id, { description: tf('todayView.defaultAction', language, { name: c.name }), dueDate: addDays(today, 1) })}
                        className="px-3 py-1.5 text-sm font-semibold rounded-md bg-primary text-white hover:bg-primary/90 active:scale-95 transition"
                      >
                        {t('todayView.setAction', language)}
                      </button>
                    )}
                    <button onClick={() => onOpenCustomer(c.id)} className="px-3 py-1.5 text-sm font-medium rounded-md bg-secondary hover:bg-border transition">{t('todayView.open', language)}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TodayView;
