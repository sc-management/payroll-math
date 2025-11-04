import { describe, it, expect } from 'vitest';
import { applyMinimumPayAdjustment } from '../src';

describe('minimum pay adjustment', () => {
  it('does not adjust when payAmount exceeds the computed minimum', () => {
    const res = applyMinimumPayAdjustment({
      regularHours: 40,
      overtimeHours: 0,
      payAmount: 1000,
      tips: 50,
      tipsCash: 60,
      bonus: 0,
      minimumWage: 15,
    });
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
      minimumWage: 20,
    });
    // cash tips are fully applied up to the difference (80)
    expect(res.tipsCash).toBe(80);
    // tips are increased to cover the remaining shortfall
    expect(res.tips).toBe(240);
  });
});
