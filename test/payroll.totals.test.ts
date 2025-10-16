import { describe, it, expect } from 'vitest';
import { sumPayrollTotals } from '../src';

describe('sumPayrollTotals', () => {
  it('rounds like UI', () => {
    const { totalTips, totalCashTips } = sumPayrollTotals([
      { ccTips: 100.4, sc: 49.6, cashTips: 20.4 },
      { ccTips: 50.5, sc: 9.4, cashTips: 10.5 },
    ]);
    expect(totalTips).toBe(Math.round(100.4 + 49.6 + 50.5 + 9.4)); // 210
    expect(totalCashTips).toBe(Math.round(20.4 + 10.5)); // 31
  });
});
