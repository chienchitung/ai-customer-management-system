export const CURRENCIES = ['USD', 'TWD', 'EUR', 'JPY', 'GBP'] as const;
export interface Rate { date: string; base: string; quote: string; rate: number }
export function convertMoney(amount: number, from: string, to: string, rates: Rate[]): number | null {
  if (from === to) return amount;
  const source = from === 'USD' ? 1 : rates.find(r => r.quote === from)?.rate;
  const target = to === 'USD' ? 1 : rates.find(r => r.quote === to)?.rate;
  return source && target ? amount / source * target : null;
}
/** Short form for headline figures: USD 385K, USD 1.2M. Small amounts stay in full, without cents. */
export function formatMoneyCompact(amount: number, currency: string) {
  const compact = Math.abs(amount) >= 10000;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code', notation: compact ? 'compact' : 'standard', minimumFractionDigits: 0, maximumFractionDigits: compact ? 1 : 0 }).format(amount);
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: currency === 'JPY' ? 0 : 2 }).format(amount);
}
