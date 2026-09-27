import { CurrencyControls, useCurrency } from './Currency';
import { convertMoney, formatMoney } from '../lib/currency';
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

const StatCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
    <div className="card metric-card px-5 py-4">
        <h3 className="text-xs font-medium text-text-secondary">{title}</h3>
        <p className="text-xl xl:text-2xl break-words font-bold tracking-tight mt-1 text-text-primary tabular-nums">{value}</p>
        {description && <p className="text-xs text-text-secondary mt-2">{description}</p>}
    </div>
);

const Panel: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
    <div className="card p-5">
        <div className="flex items-center justify-between mb-4 gap-2 min-h-7">
            <h3 className="card-title">{title}</h3>
            {action}
        </div>
        {children}
    </div>
);

// Interaction type colors (validated for both themes).
const TYPE_COLORS: Record<InteractionType, string> = {
    [InteractionType.EMAIL]: 'chart-green',
    [InteractionType.CALL]: 'chart-blue',
    [InteractionType.MEETING]: 'chart-mint',
    [InteractionType.NOTE]: 'chart-neutral',
};

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ customers: originals, language }) => {
    const fx = useCurrency();
    const missing = originals.some(c => c.dealValue != null && convertMoney(c.dealValue, c.dealCurrency || 'USD', fx.currency, fx.rates) == null);
    const customers = useMemo(() => originals.map(c => ({ ...c, dealValue: c.dealValue == null ? undefined : convertMoney(c.dealValue, c.dealCurrency || 'USD', fx.currency, fx.rates) ?? undefined })), [originals, fx.currency, fx.rates]);
    const money = (n: number) => missing ? '—' : formatMoney(n, fx.currency);
    const m = useMemo(() => computeMetrics(customers, todayISO()), [customers]);
    const funnel = useMemo(() => Object.values(CustomerStatus).map(status => ({
        status,
        count: customers.filter(c => c.status === status).length,
        value: customers.filter(c => c.status === status).reduce((s, c) => s + (c.dealValue ?? 0), 0),
    })), [customers]);
    const maxCount = Math.max(...funnel.map(f => f.count), 1);
    const maxWeek = Math.max(...m.activityByWeek.map(w => sum(w.counts)), 1);

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
            <details className="mb-4 rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary"><summary className="cursor-pointer font-medium">{language === 'zh' ? '統計範圍與計算方式' : 'Reporting scope and methodology · USD'}</summary><p className="mt-2 leading-relaxed">{language === 'zh' ? '管線為目前未結案商機；成交率與成交金額涵蓋所有已結案資料，活動趨勢為最近 8 週。金額依選定幣別，以最新參考匯率換算（包括已成交金額，非固定歷史帳務）。加權預測 = 商機金額 × 預設機率（銷售線索 10%、潛在客戶 30%、談判中 60%），是估算而非保證收入。' : 'Pipeline is a current snapshot of open deals. Win rate and won value cover all closed records; activity trends cover the last 8 weeks. Amounts use the selected currency and latest reference rates, including closed deals (not fixed historical accounting). Forecast uses deal value × default probability (Lead 10%, Prospect 30%, Negotiation 60%); it is an estimate, not guaranteed revenue.'}</p></details>
            <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary mb-1">{language === 'zh' ? '業務洞察' : 'Revenue intelligence'}</p><p className="text-sm text-text-secondary">{language === 'zh' ? '掌握管線健康度、轉換效率與團隊活動。' : 'Monitor pipeline health, conversion efficiency, and team activity.'}</p></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title={t('pipelineValue', language)} value={money(m.pipelineValue)} description={t('pipelineValueDesc', language)} />
                <StatCard title={t('dash.weightedForecast', language)} value={money(m.weightedForecast)} description={t('dash.weightedForecastDesc', language)} />
                <StatCard title={t('dash.winRate', language)} value={pct(m.winRate)} description={t('dash.winRateDesc', language)} />
                <StatCard title={t('dash.wonValue', language)} value={money(m.wonValue)} description={t('dash.wonValueDesc', language)} />
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
                                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                    <div className={`h-full rounded-full ${STATUS_DOT[status]} transition-all duration-500 ease-out`} style={{ width: `${(count / maxCount) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title={t('dash.conversion', language)}>
                    <table className="w-full text-sm">
                        <thead className="text-xs text-text-secondary text-left">
                            <tr><th className="font-medium pb-2"></th><th className="font-medium pb-2">{t('dash.conversion', language)}</th><th className="font-medium pb-2">{t('dash.avgDays', language)}</th></tr>
                        </thead>
                        <tbody>
                            {m.stageConversion.map((s, i) => (
                                <tr key={s.from} className="border-t border-border">
                                    <td className="py-2">{translateStatus(s.from, language)} → {translateStatus(s.to, language)}</td>
                                    <td className="py-2 font-semibold">{pct(s.rate)}</td>
                                    <td className="py-2">{m.avgDaysInStage[i].days ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Panel>

                <Panel title={t('dash.activity', language)}>
                    <div className="flex items-end gap-2 h-40" role="img" aria-label={t('dash.activity', language)}>
                        {m.activityByWeek.map(w => {
                            const total = sum(w.counts);
                            return (
                                <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${w.weekStart}: ${total}`}>
                                    <span className="text-xs text-text-secondary">{total || ''}</span>
                                    <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden gap-px" style={{ height: `${(total / maxWeek) * 100}%` }}>
                                        {Object.values(InteractionType).map(type => w.counts[type] > 0 && (
                                            <div key={type} className={TYPE_COLORS[type]} style={{ flexGrow: w.counts[type] }} />
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-text-secondary">{w.weekStart.slice(5)}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-text-secondary">
                        {Object.values(InteractionType).map(type => (
                            <span key={type} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-sm ${TYPE_COLORS[type]}`} />{translateInteractionType(type, language)}</span>
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
                                    <span><span className="font-medium">{r.company}</span> — {r.reason}</span>
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
