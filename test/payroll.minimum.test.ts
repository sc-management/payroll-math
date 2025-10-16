import { describe, it, expect } from 'vitest';
import { applyMinimumPayAdjustment } from '../src';

describe('minimum pay adjustment', () => {
  it('bumps tips/tipsCash/payAmount to meet minimum', () => {
    const r = applyMinimumPayAdjustment({
      regularHours: 38,
      overtimeHours: 4,
      payAmount: 800, // 现有工资(小时工资+已计入的)
      tips: 100,
      tipsCash: 120,
      bonus: 20,
      minPayRate: 15,
    });
    expect(r.minimumPay).toBeCloseTo(15 * 38 + 1.5 * 15 * 4, 6);
    expect(r.payAmount).toBeGreaterThanOrEqual(r.minimumPay);
  });

  it('does not adjust when payAmount exceeds the computed minimum', () => {
    const res = applyMinimumPayAdjustment({
      regularHours: 40,
      overtimeHours: 0,
      payAmount: 1000,
      tips: 50,
      tipsCash: 60,
      bonus: 0,
      minPayRate: 15,
    });
    // minimumPay = 15 * 40 = 600
    expect(res.minimumPay).toBe(600);
    // payAmount remains unchanged because it is already >= minimumPay
    expect(res.payAmount).toBe(1000);
    // tips remain unchanged
    expect(res.tips).toBe(50);
    // no cash adjustment is needed
    expect(res.tipsCash).toBe(0);
  });

  it('adjusts tips and cash tips when payAmount is below the minimum', () => {
    const res = applyMinimumPayAdjustment({
      regularHours: 20,
      overtimeHours: 10,
      payAmount: 400,
      tips: 20,
      tipsCash: 80,
      bonus: 0,
      minPayRate: 20,
    });
    // minimumPay = 20*20 + 1.5*20*10 = 400 + 300 = 700
    expect(res.minimumPay).toBe(700);
    // payAmount is raised to the minimum pay
    expect(res.payAmount).toBe(700);
    // cash tips are fully applied up to the difference (80)
    expect(res.tipsCash).toBe(80);
    // tips are increased to cover the remaining shortfall
    expect(res.tips).toBe(240);
  });
});
