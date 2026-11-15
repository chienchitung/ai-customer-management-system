import { describe, it, expect } from 'vitest';
import { convertMoney, formatMoneyCompact } from './currency';
const rates = [{ base: 'USD', quote: 'TWD', rate: 32, date: '2026-09-27' }, { base: 'USD', quote: 'EUR', rate: 0.8, date: '2026-09-27' }];
describe('currency conversion', () => {
  it('converts through a common base', () => { expect(convertMoney(3200, 'TWD', 'EUR', rates)).toBe(80); });
  it('preserves same-currency amounts without network', () => { expect(convertMoney(100, 'USD', 'USD', [])).toBe(100); });
  it('does not invent missing rates', () => { expect(convertMoney(100, 'JPY', 'USD', rates)).toBeNull(); });
  it('preserves zero', () => { expect(convertMoney(0, 'TWD', 'USD', rates)).toBe(0); });
});

describe('formatMoneyCompact', () => {
  it('compacts large amounts and drops cents on small ones', () => {
    // Intl separates the code with a no-break space; compare on plain spaces.
    const fmt = (n: number, c: string) => formatMoneyCompact(n, c).replace(/\s/g, ' ');
    expect(fmt(385000, 'USD')).toBe('USD 385K');
    expect(fmt(130500, 'USD')).toBe('USD 130.5K');
    expect(fmt(1250000, 'TWD')).toBe('TWD 1.3M');
    expect(fmt(9500, 'USD')).toBe('USD 9,500');
  });
});
