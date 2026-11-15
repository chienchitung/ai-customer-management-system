import { CurrencyControls, useCurrency } from './Currency';
import { convertMoney, formatMoney, formatMoneyCompact } from '../lib/currency';
import React, { useMemo, useState } from 'react';
import { Customer, CustomerStatus, InteractionType } from '../types';
import { StatusBadge, STATUS_DOT } from './ui';
import { t, translateStatus, translateInteractionType } from '../localization';
import { computeMetrics } from '../lib/insights';
import { todayISO } from '../lib/dates';
import { analyzeClosedDeals } from '../services/geminiService';
import { MarkdownRenderer } from './AIAssistant';
import { aiErrorMessage } from './Dialogs';
import { SparklesIcon } from './icons';

interface AnalyticsDashboardProps {
    customers: Customer[];
    language: 'en' | 'zh';
}


const sum = (counts: Record<InteractionType, number>) => Object.values(InteractionType).reduce((a, k) => a + counts[k], 0);
const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);

// Headline values use proportional figures; tabular-nums is kept for aligned columns only.
const StatCard: React.FC<{ title: string; value: string | number; fullValue?: string; description?: string }> = ({ title, value, fullValue, description }) => (
    <div className="card metric-card px-4 sm:px-5 py-4 min-w-0">
        <h2 className="text-xs font-medium text-text-secondary">{title}</h2>
        <p className="text-xl xl:text-2xl font-semibold tracking-tight mt-1 text-text-primary truncate" title={fullValue}>{value}</p>
        {description && <p className="text-xs text-text-secondary mt-2">{description}</p>}
    </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
    <div className="card p-5">
        <div className="flex items-center justify-between mb-4 gap-2 min-h-7">
            <h2 className="card-title">{title}</h2>
            {action}
        </div>
        {children}
    </div>
);

// Interaction type colors: categorical slots 1-3 in fixed order, notes in the de-emphasis gray.
// Validated with the dataviz palette checker against both surfaces (adjacent CVD ΔE >= 9).
const TYPE_COLORS: Record<InteractionType, string> = {
    [InteractionType.EMAIL]: 'viz-1',
    [InteractionType.CALL]: 'viz-2',
    [InteractionType.MEETING]: 'viz-3',
    [InteractionType.NOTE]: 'chart-neutral',
};
const TYPES = Object.values(InteractionType);

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ customers: originals, language }) => {
    const fx = useCurrency();
    const missing = originals.some(c => c.dealValue != null && convertMoney(c.dealValue, c.dealCurrency || 'USD', fx.currency, fx.rates) == null);
    const customers = useMemo(() => originals.map(c => ({ ...c, dealValue: c.dealValue == null ? undefined : convertMoney(c.dealValue, c.dealCurrency || 'USD', fx.currency, fx.rates) ?? undefined })), [originals, fx.currency, fx.rates]);
    const money = (n: number) => missing ? '—' : formatMoney(n, fx.currency);
    const moneyShort = (n: number) => missing ? '—' : formatMoneyCompact(n, fx.currency);
    const m = useMemo(() => computeMetrics(customers, todayISO()), [customers]);
    const funnel = useMemo(() => Object.values(CustomerStatus).map(status => ({
        status,
        count: customers.filter(c => c.status === status).length,
        value: customers.filter(c => c.status === status).reduce((s, c) => s + (c.dealValue ?? 0), 0),
    })), [customers]);
    const maxCount = Math.max(...funnel.map(f => f.count), 1);
    const maxWeek = Math.max(...m.activityByWeek.map(w => sum(w.counts)), 1);

    const [activeWeek, setActiveWeek] = useState<number | null>(null);
    const [activityTable, setActivityTable] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const analyze = async () => {
        setAnalyzing(true);
        try {
            setInsight(await analyzeClosedDeals(originals, language));
        } catch (e) {
            setInsight(aiErrorMessage(e, language));
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto pb-8 -mx-4 md:-mx-6 px-4 md:px-6">
          <div className="max-w-6xl mx-auto"><div className="mb-4"><CurrencyControls language={language} />{missing && <p role="alert" className="text-sm text-rose-600">{language === 'zh' ? '部分幣別缺少匯率，暫不顯示金額總計。' : 'Some rates are unavailable. Monetary totals are hidden.'}</p>}</div>
            <details className="group mb-4 rounded-lg border border-border bg-surface text-xs text-text-secondary"><summary className="cursor-pointer select-none list-none flex items-center gap-2 px-4 py-3 text-sm font-medium text-text-primary hover:bg-secondary/50 rounded-lg"><span className="transition-transform group-open:rotate-90 text-text-secondary" aria-hidden="true">▸</span>{language === 'zh' ? '統計範圍與計算方式' : 'Reporting scope and methodology'}</summary><p className="px-4 pb-3 leading-relaxed">{language === 'zh' ? '管線為目前未結案商機；成交率與成交金額涵蓋所有已結案資料，活動趨勢為最近 8 週。金額依選定幣別，以最新參考匯率換算（包括已成交金額，非固定歷史帳務）。加權預測 = 商機金額 × 預設機率（銷售線索 10%、潛在客戶 30%、談判中 60%），是估算而非保證收入。' : 'Pipeline is a current snapshot of open deals. Win rate and won value cover all closed records; activity trends cover the last 8 weeks. Amounts use the selected currency and latest reference rates, including closed deals (not fixed historical accounting). Forecast uses deal value × default probability (Lead 10%, Prospect 30%, Negotiation 60%); it is an estimate, not guaranteed revenue.'}</p></details>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title={t('pipelineValue', language)} value={moneyShort(m.pipelineValue)} fullValue={money(m.pipelineValue)} description={t('pipelineValueDesc', language)} />
                <StatCard title={t('dash.weightedForecast', language)} value={moneyShort(m.weightedForecast)} fullValue={money(m.weightedForecast)} description={t('dash.weightedForecastDesc', language)} />
                <StatCard title={t('dash.winRate', language)} value={pct(m.winRate)} description={t('dash.winRateDesc', language)} />
                <StatCard title={t('dash.wonValue', language)} value={moneyShort(m.wonValue)} fullValue={money(m.wonValue)} description={t('dash.wonValueDesc', language)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <Panel title={t('salesFunnel', language)}>
                    <div className="space-y-3">
                        {funnel.map(({ status, count, value }) => (
                            <div key={status}>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                                        {translateStatus(status, language)}
                                        <span className="text-text-secondary tabular-nums">{count}</span>
                                    </span>
                                    <span className="text-xs text-text-secondary tabular-nums">{money(value)}</span>
                                </div>
                                <div className="h-1.5 bg-secondary/70 rounded-r-[4px]">
                                    <div className="h-full rounded-r-[4px] viz-1 transition-all duration-500 ease-out" style={{ width: `${(count / maxCount) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title={t('dash.conversion', language)}>
                    <table className="w-full text-sm">
                        <thead className="text-xs text-text-secondary text-left">
                            <tr><th className="font-medium pb-2">{t('dash.stage', language)}</th><th className="font-medium pb-2 text-right">{t('dash.rate', language)}</th><th className="font-medium pb-2 text-right">{t('dash.avgDays', language)}</th></tr>
                        </thead>
                        <tbody>
                            {m.stageConversion.map((s, i) => (
                                <tr key={s.from} className="border-t border-border">
                                    <td className="py-2">{translateStatus(s.from, language)} → {translateStatus(s.to, language)}</td>
                                    <td className="py-2 font-semibold text-right tabular-nums">{pct(s.rate)}</td>
                                    <td className="py-2 text-right tabular-nums">{m.avgDaysInStage[i].days ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>

                <Panel
                    title={t('dash.activity', language)}
                    action={
                        <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label={t('dash.activity', language)}>
                            {[false, true].map(table => (
                                <button key={String(table)} type="button" aria-pressed={activityTable === table} onClick={() => setActivityTable(table)}
                                    className={`px-2 py-0.5 rounded ${activityTable === table ? 'bg-secondary text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary'}`}>
                                    {t(table ? 'dash.showTable' : 'dash.showChart', language)}
                                </button>
                            ))}
                        </div>
                    }
                >
                    {activityTable ? (
                        <table className="w-full text-sm">
                            <thead className="text-xs text-text-secondary">
                                <tr>
                                    <th className="font-medium pb-2 text-left">{t('dash.weekOf', language)}</th>
                                    {TYPES.map(type => <th key={type} className="font-medium pb-2 text-right">{translateInteractionType(type, language)}</th>)}
                                    <th className="font-medium pb-2 text-right">{t('dash.total', language)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {m.activityByWeek.map(w => (
                                    <tr key={w.weekStart} className="border-t border-border">
                                        <td className="py-1.5 tabular-nums">{w.weekStart}</td>
                                        {TYPES.map(type => <td key={type} className="py-1.5 text-right tabular-nums">{w.counts[type]}</td>)}
                                        <td className="py-1.5 text-right tabular-nums font-medium">{sum(w.counts)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div>
                            <div className="relative flex items-end h-40 pt-6 border-b border-border">
                                {m.activityByWeek.map((w, i) => {
                                    const total = sum(w.counts);
                                    const isLast = i === m.activityByWeek.length - 1;
                                    const breakdown = TYPES.filter(type => w.counts[type] > 0).map(type => `${translateInteractionType(type, language)} ${w.counts[type]}`).join(', ');
                                    return (
                                        <button
                                            key={w.weekStart}
                                            type="button"
                                            className={`flex-1 h-full flex items-end justify-center rounded-t-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${activeWeek === i ? 'bg-secondary/60' : ''}`}
                                            aria-label={`${t('dash.weekOf', language)} ${w.weekStart}: ${total}${breakdown ? ` (${breakdown})` : ''}`}
                                            onMouseEnter={() => setActiveWeek(i)} onMouseLeave={() => setActiveWeek(null)}
                                            onFocus={() => setActiveWeek(i)} onBlur={() => setActiveWeek(null)}
                                        >
                                            <span className="relative w-full max-w-[24px]" style={{ height: `${(total / maxWeek) * 100}%` }}>
                                                {isLast && total > 0 && <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs font-medium text-text-primary tabular-nums">{total}</span>}
                                                <span className="flex flex-col-reverse gap-[2px] h-full rounded-t-[4px] overflow-hidden">
                                                    {TYPES.map(type => w.counts[type] > 0 && (
                                                        <span key={type} className={TYPE_COLORS[type]} style={{ flexGrow: w.counts[type] }} />
                                                    ))}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                                {activeWeek !== null && (() => {
                                    const w = m.activityByWeek[activeWeek];
                                    const n = m.activityByWeek.length;
                                    // Sit beside the column, on the side with more room, so the tooltip never covers the bar it describes.
                                    const pos = activeWeek >= n / 2 ? { right: `${(1 - activeWeek / n) * 100}%` } : { left: `${((activeWeek + 1) / n) * 100}%` };
                                    return (
                                        <div role="presentation" className="pointer-events-none absolute top-0 z-10 min-w-[9rem] rounded-md border border-border bg-surface shadow-lg px-3 py-2 text-xs" style={pos}>
                                            <p className="font-medium text-text-primary mb-1">{t('dash.weekOf', language)} {w.weekStart}</p>
                                            {TYPES.map(type => (
                                                <p key={type} className="flex items-center gap-2 text-text-secondary">
                                                    <span className={`w-2 h-2 rounded-sm ${TYPE_COLORS[type]}`} />
                                                    <span className="flex-grow">{translateInteractionType(type, language)}</span>
                                                    <span className="tabular-nums text-text-primary">{w.counts[type]}</span>
                                                </p>
                                            ))}
                                            <p className="flex justify-between mt-1 pt-1 border-t border-border font-medium text-text-primary"><span>{t('dash.total', language)}</span><span className="tabular-nums">{sum(w.counts)}</span></p>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="flex mt-1.5" aria-hidden="true">
                                {m.activityByWeek.map((w, i) => (
                                    <span key={w.weekStart} className="flex-1 text-center text-[10px] text-text-secondary tabular-nums">{i === m.activityByWeek.length - 1 ? t('dash.latest', language) : w.weekStart.slice(5)}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-text-secondary">
                        {TYPES.map(type => (
                            <span key={type} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${TYPE_COLORS[type]}`} />{translateInteractionType(type, language)}</span>
                        ))}
                    </div>
                </Panel>

                <Panel
                    title={t('dash.closedReasons', language)}
                    action={m.closedReasons.length > 0 && (
                        <button onClick={analyze} disabled={analyzing} className="btn btn-sm btn-secondary">
                            <SparklesIcon className="w-3.5 h-3.5 text-primary" />{t(analyzing ? 'dash.analyzing' : 'dash.aiAnalyze', language)}
                        </button>
                    )}
                >
                    {m.closedReasons.length === 0 ? (
                        <p className="text-sm text-text-secondary">{t('dash.noReasons', language)}</p>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {m.closedReasons.map((r, i) => (
                                <li key={i} className="flex gap-2">
                                    <StatusBadge status={r.status} language={language} className="h-fit" />
                                    <span><span className="font-medium">{r.company}</span>{language === 'zh' ? '：' : ': '}{r.reason}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {insight && <div className="mt-4 p-3 rounded-md bg-secondary/60 border border-border"><MarkdownRenderer content={insight} /></div>}
                </Panel>
            </div>
          </div>
        </div>
    );
};

export default AnalyticsDashboard;
