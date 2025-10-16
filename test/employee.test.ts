import { describe, it, expect } from 'vitest';
import { calculateEmployee, PeriodInfo } from '../src';

const p: PeriodInfo = {
  periodId: 2,
  sales: 1000,
  ccTips: 500,
  sc: 100,
  cashTips: 200,
  totalTips: 600,
  busPercent: 0.1,
};

describe('employee calc (server)', () => {
  it('server splits by percent (minus other roles)', () => {
    const r = calculateEmployee({
      roleId: 1,
      payRate: 10,
      payType: 1,
      hour: 8,
      minPayRate: 15,
      currentCc: 0,
      currentCash: 0,
      percent: 0.25,
      period: p,
      otherRoleTotalCcTips: 100,
      otherRoleTotalCashTips: 50,
      bartenderTotalCcTips: 0,
      bartenderTotalCashTips: 0,
      hostTotalCcTips: 0,
      hostTotalCashTips: 0,
      othersPercentage: 50,
      otherPeriodTotalHours: 4,
      otherPeriodTotalCc: 50,
      otherPeriodTotalCash: 20,
    });
    expect(r.tipsCc).toBe(Math.round((600 - 100) * 0.25));
    expect(r.tipsCash).toBe(Math.round((200 - 50) * 0.25));
    expect(r.rolePercentage).toBeCloseTo(75);
  });

  it('allocates tips to bussers based on busPercent and percent after subtracting bartender/host payouts', () => {
    const period: PeriodInfo = {
      periodId: 1,
      sales: 1000,
      ccTips: 500,
      sc: 100,
      cashTips: 200,
      totalTips: 600,
      busPercent: 0.1,
    };
    const res = calculateEmployee({
      roleId: 2,
      payRate: 10,
      payType: 1,
      hour: 8,
      minPayRate: 15,
      currentCc: 0,
      currentCash: 0,
      percent: 0.2,
      period,
      otherRoleTotalCcTips: 0,
      otherRoleTotalCashTips: 0,
      bartenderTotalCcTips: 100,
      bartenderTotalCashTips: 50,
      hostTotalCcTips: 50,
      hostTotalCashTips: 20,
      othersPercentage: 30,
      otherPeriodTotalHours: 4,
      otherPeriodTotalCc: 0,
      otherPeriodTotalCash: 0,
    });
    // For bussers, cc pool = max(totalTips - bartender - host) = 600 - 100 - 50 = 450
    // Then multiply by busPercent (0.1) and percent (0.2): 450 * 0.1 * 0.2 = 9
    expect(res.tipsCc).toBe(9);
    // cash pool = cashTips - bartender - host = 200 - 50 - 20 = 130
    // cash tips = 130 * 0.1 * 0.2 = 2.6 → rounds to integer
    expect(res.tipsCash).toBe(3);
    // rolePercentage = othersPercentage + percent*100
    expect(res.rolePercentage).toBeCloseTo(30 + 0.2 * 100);
  });

  it('uses currentCc and currentCash for roles other than server/busser', () => {
    const period: PeriodInfo = {
      periodId: 1,
      sales: 500,
      ccTips: 200,
      sc: 50,
      cashTips: 100,
      totalTips: 250,
      busPercent: 0.1,
    };
    const res = calculateEmployee({
      roleId: 99,
      payRate: 20,
      payType: 1,
      hour: 5,
      minPayRate: 15,
      currentCc: 10,
      currentCash: 5,
      percent: 0,
      period,
      otherRoleTotalCcTips: 0,
      otherRoleTotalCashTips: 0,
      bartenderTotalCcTips: 0,
      bartenderTotalCashTips: 0,
      hostTotalCcTips: 0,
      hostTotalCashTips: 0,
      othersPercentage: 0,
      otherPeriodTotalHours: 0,
      otherPeriodTotalCc: 0,
      otherPeriodTotalCash: 0,
    });
    // For non‑server/busser roles, tipsCc and tipsCash come directly from the inputs
    expect(res.tipsCc).toBe(10);
    expect(res.tipsCash).toBe(5);
    // Total should include hourly payment and tips, constrained by minPayRate
    expect(res.total).toBeGreaterThanOrEqual(5 * 15);
  });
});
