import { describe, it, expect } from 'vitest';
import { calculatePeriodTotals } from '../src';

describe('period totals', () => {
  it('cc + sc, and tips% = total/sales', () => {
    const r = calculatePeriodTotals({ sales: 1000, ccTips: 500, sc: 100, cashTips: 200 });
    expect(r.totalTips).toBe(600);
    expect(r.tipsPercent).toBeCloseTo(0.6);
  });

  it('handles decimals and rounds totalTips to two decimals and tipsPercent to four decimals', () => {
    const result = calculatePeriodTotals({
      sales: 1000,
      ccTips: 50.555,
      sc: 0.333,
      cashTips: 0,
    });
    // ccTips + sc = 50.888 → rounds to 50.89
    expect(result.totalTips).toBeCloseTo(50.89, 2);
    // 50.89 / 1000 = 0.05089 → rounds to 0.0509
    expect(result.tipsPercent).toBeCloseTo(0.0509, 4);
  });

  it('returns a zero percentage when sales is zero', () => {
    const result = calculatePeriodTotals({
      sales: 0,
      ccTips: 123.45,
      sc: 10.55,
      cashTips: 0,
    });
    // Total tips are still calculated and rounded to the cent
    expect(result.totalTips).toBeCloseTo(134.0, 2);
    // When sales is zero, tipsPercent is defined as zero
    expect(result.tipsPercent).toBe(0);
  });
});
