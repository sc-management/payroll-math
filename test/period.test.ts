import { describe, it, expect } from 'vitest';
import { calculatePeriodTotals } from '../src';

describe('period totals', () => {
  it('cc + sc, and tips% = total/sales', () => {
    const r = calculatePeriodTotals({ sales: 1000, ccTips: 500, sc: 100, cashTips: 200 });
    expect(r.totalTips).toBe(600);
    expect(r.tipsPercent).toBeCloseTo(0.6);
  });
});
