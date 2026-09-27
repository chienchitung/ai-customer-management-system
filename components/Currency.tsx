import React, { createContext, useContext, useState, useEffect, useCallback, useId } from 'react';
import { RefreshCw } from 'lucide-react';
import { CURRENCIES, Rate, convertMoney, formatMoney } from '../lib/currency';
import { Customer } from '../types';

const KEY = 'pulse.fx.v1';
function cached(): { rates: Rate[]; fetched: string } { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { rates: [], fetched: '' }; } catch { return { rates: [], fetched: '' }; } }
const Context = createContext<{ currency: string; setCurrency: (s: string) => void; rates: Rate[]; fetched: string; error: boolean; loading: boolean; refresh: () => void }>({ currency: 'USD', setCurrency: () => {}, rates: [], fetched: '', error: false, loading: false, refresh: () => {} });
export const useCurrency = () => useContext(Context);
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState(() => { try { const s = localStorage.getItem('pulse.currency'); return CURRENCIES.includes(s as typeof CURRENCIES[number]) ? s! : 'USD'; } catch { return 'USD'; } });
  const [cache, setCache] = useState(cached);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=TWD,EUR,JPY,GBP', { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('rates');
      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.length || !data.every(r => r.base === 'USD' && CURRENCIES.includes(r.quote) && Number.isFinite(r.rate) && r.rate > 0 && typeof r.date === 'string')) throw new Error('invalid rates');
      const next = { rates: data as Rate[], fetched: new Date().toISOString() };
      setCache(next); setError(false);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 3600000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => { try { localStorage.setItem('pulse.currency', currency); } catch { /* storage unavailable */ } }, [currency]);
  return <Context.Provider value={{ currency, setCurrency, ...cache, error, loading, refresh }}>{children}</Context.Provider>;
}
export function CurrencyControls({ language }: { language: 'zh' | 'en' }) {
  const selectId = useId();
  const fx = useCurrency(); const zh = language === 'zh';
  return <div className="space-y-2"><div className="flex gap-2 items-center flex-wrap"><label htmlFor={selectId} className="text-sm">{zh ? '顯示幣別' : 'Display currency'}</label><select id={selectId} className="input w-auto" value={fx.currency} onChange={e => fx.setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select><button className="btn btn-secondary" onClick={fx.refresh} disabled={fx.loading}><RefreshCw className="w-4 h-4" />{zh ? '更新匯率' : 'Refresh rates'}</button></div><p role="status" className="text-xs text-text-secondary">Frankfurter · {zh ? '每日參考匯率，非即時銀行成交價' : 'Daily reference rates, not live bank quotes'} · {fx.rates.length ? fx.rates.map(r => r.date).sort()[0] : (zh ? '尚無匯率' : 'No rates')} {fx.error && (zh ? '· 更新失敗，使用上次快取；無快取時不換算' : '· Update failed; using cache when available')} {fx.loading && (zh ? '· 更新中' : '· Updating')}</p>{fx.fetched && <p className="text-xs text-text-secondary">{zh ? '擷取時間：' : 'Fetched: '}{new Date(fx.fetched).toLocaleString()}</p>}</div>;
}
export function DealAmount({ customer, equivalent = false }: { customer: Customer; equivalent?: boolean }) {
  const fx = useCurrency(); if (customer.dealValue == null) return <>—</>;
  const source = customer.dealCurrency || 'USD'; const value = convertMoney(customer.dealValue, source, fx.currency, fx.rates);
  const rate = convertMoney(1, source, fx.currency, fx.rates);
  return <span>{formatMoney(customer.dealValue, source)}{equivalent && source !== fx.currency && <span className="block text-xs text-text-secondary">{value == null ? '—' : '≈ ' + formatMoney(value, fx.currency)}{rate != null && <span className="block">1 {source} = {rate.toFixed(5)} {fx.currency}</span>}</span>}</span>;
}
