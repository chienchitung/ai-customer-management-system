import { describe, it, expect } from 'vitest';
import { convertMoney } from './currency';
const rates = [{ base: 'USD', quote: 'TWD', rate: 32, date: '2026-09-27' }, { base: 'USD', quote: 'EUR', rate: 0.8, date: '2026-09-27' }];
describe('currency conversion', () => {
  it('converts through a common base', () => { expect(convertMoney(3200, 'TWD', 'EUR', rates)).toBe(80); });
  it('preserves same-currency amounts without network', () => { expect(convertMoney(100, 'USD', 'USD', [])).toBe(100); });
  it('does not invent missing rates', () => { expect(convertMoney(100, 'JPY', 'USD', rates)).toBeNull(); });
  it('preserves zero', () => { expect(convertMoney(0, 'TWD', 'USD', rates)).toBe(0); });
});
