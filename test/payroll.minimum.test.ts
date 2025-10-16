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
});
