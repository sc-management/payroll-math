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

  it('sums cc_tips + sc into total_tips, sums cash_tips into total_cash_tips, both rounded to integers', () => {
    const periods = [
      { ccTips: 123.45, sc: 10.5, cashTips: 40.4 },
      { ccTips: 80.49, sc: 0.51, cashTips: 19.6 },
      { ccTips: 0, sc: 0, cashTips: 0 },
    ];
    // 前端页面的整周合计：total_tips / total_cash_tips 都是 Math.round
    const res = sumPayrollTotals(periods);
    // total_tips = 123.45+10.5 + 80.49+0.51 = 214.95 → round = 215
    // total_cash_tips = 40.4 + 19.6 = 60.0 → round = 60
    expect(res.totalTips).toBe(215);
    expect(res.totalCashTips).toBe(60);
  });

  it('treats missing/NaN/undefined as 0 and still rounds', () => {
    const periods: any[] = [
      { ccTips: undefined, sc: 3.2, cashTips: 1.9 },
      { ccTips: NaN, sc: NaN, cashTips: undefined },
      { sc: 1.49, cashTips: 0.51 }, // cc_tips 缺失
    ];
    const res = sumPayrollTotals(periods);
    // cc+sc = 0+3.2  + 0+0 + 0+1.49 = 4.69 → round 5
    // cash   = 1.9 + 0 + 0.51 = 2.41 → round 2
    expect(res.totalTips).toBe(5);
    expect(res.totalCashTips).toBe(2);
  });
});
