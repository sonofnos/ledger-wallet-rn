import { formatMoney } from './theme';

describe('formatMoney', () => {
  it('formats whole-naira amounts', () => {
    expect(formatMoney(500000)).toBe('₦5,000.00');
  });

  it('formats amounts with cents', () => {
    expect(formatMoney(123456)).toBe('₦1,234.56');
  });

  it('formats zero', () => {
    expect(formatMoney(0)).toBe('₦0.00');
  });

  it('respects a different currency code', () => {
    expect(formatMoney(100, 'USD')).toBe('US$1.00');
  });
});
