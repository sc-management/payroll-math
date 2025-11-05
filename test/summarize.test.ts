import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summarizeWeekly } from '../src';

vi.mock('../src/core/minimumPay', () => ({
  applyMinimumPayAdjustment: vi.fn((input: any) => {
    // No-op mock: return tips unchanged
    return {
      tips: input.tips,
      tipsCash: input.tipsCash,
    };
  }),
}));

// Helpers
const empKey = (uid: string) => uid;

// Build a minimal reconciled shape that summarizeWeekly expects
function makeReconciled({
  uid = 'u1',
  name = 'Alice',
  roleId = '1',
  roleName = 'Server',
  payRate = 1500, // cents/hour
  minimumWage = 1500, // cents/hour
  day1 = {
    date: '2025-10-01',
    hours: 8,
    ccTips: 4000,
    cashTips: 1000,
    serviceCharge: 0,
  },
  day2 = {
    date: '2025-10-02',
    hours: 11, // >= 10 to trigger spread-of-hours when enabled
    ccTips: 5000,
    cashTips: 500,
    serviceCharge: 0,
  },
}: Partial<any> = {}) {
  const days = [day1, day2].map((d) => ({
    date: d.date,
    totals: {
      hours: d.hours,
      ccTips: d.ccTips,
      cashTips: d.cashTips,
      serviceCharge: d.serviceCharge,
    },
  }));

  // Employee per-day reconciliation entries (minimal)
  const employees = [day1, day2].map((d) => ({
    date: d.date,
    employeeUid: uid,
    displayName: name,
    totals: {
      hours: d.hours,
      ccTips: d.ccTips,
      cashTips: d.cashTips,
      serviceCharge: d.serviceCharge,
    },
    // one hourly segment for the day
    segments: [
      {
        roleId: roleId,
        roleName: roleName,
        payRate,
        payType: 'HOURLY',
        position: 'FRONT_OF_HOUSE',
        hours: d.hours,
      },
    ],
    reconciliation: {},
  }));

  // Time clock events for the whole week, used to compute regular vs OT per role
  const timeClockEventsByEmpKey: Record<string, Array<any>> = {
    [empKey(uid)]: [day1, day2].map((d) => ({
      payType: 'HOURLY',
      roleId: roleId,
      roleName: roleName,
      clockIn: `${d.date}T09:00:00Z`,
      hours: d.hours,
    })),
  };

  return {
    days,
    employees,
    meta: {
      minimumWage,
      timeClockEventsByEmpKey,
    },
  };
}

describe('summarizeWeekly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // 每个用例重新评估模块依赖（配合动态导入）
  });

  it('aggregates weekly totals and per-employee hours/wages/tips without overtime', () => {
    const reconciled = makeReconciled();

    const result = summarizeWeekly(reconciled as any, {
      startDate: '2025-10-01',
      endDate: '2025-10-07',
    });

    // Days are carried through in range
    expect(result.days).toHaveLength(2);

    // Weekly totals = sum of days
    expect(result.totals.ccTips).toBe(4000 + 5000);
    expect(result.totals.cashTips).toBe(1000 + 500);
    expect(result.totals.serviceCharge).toBe(0);

    // One employee summarized
    expect(result.employees).toHaveLength(1);
    const emp = result.employees[0];

    // Hours by role
    const roleSummary = emp.hoursByRole['1'];
    expect(roleSummary).toBeTruthy();
    expect(roleSummary.payType).toBe('HOURLY');

    // No OT in this setup (total 19 hours)
    expect(roleSummary.regularHours).toBeCloseTo(19, 5);
    expect(roleSummary.overtimeHours).toBeCloseTo(0, 5);

    // Wages = regularHours * payRate (1500 cents)
    expect(roleSummary.wages).toBe(19 * 1500);

    // Employee totals
    expect(emp.totals.regularHours).toBeCloseTo(19, 5);
    expect(emp.totals.overtimeHours).toBeCloseTo(0, 5);

    // Tips unchanged by mocked minimum pay adjustment
    expect(emp.totals.ccTips).toBe(9000);
    expect(emp.totals.cashTips).toBe(1500);

    // Gross = wages + tips (+ spread if any; not enabled in this test)
    expect(emp.totals.gross).toBe(19 * 1500 + 9000 + 1500);
  });

  it('adds spread-of-hours role when enabled and day >= 10 hours exists', () => {
    const reconciled = makeReconciled();

    const result = summarizeWeekly(
      reconciled as any,
      {
        startDate: '2025-10-01',
        endDate: '2025-10-07',
      },
      {
        spreadRequired: true,
      },
    );

    const emp = result.employees[0];
    // day2 has 11 hours, so spreadOfHours should be 1
    expect(emp.totals.spreadOfHours).toBeCloseTo(1, 5);

    // Should inject SPREAD_OF_HOURS role with minimumWage * spreadOfHours
    const spread = emp.hoursByRole['SPREAD_OF_HOURS'];
    expect(spread).toBeTruthy();
    expect(spread.payType).toBe('HOURLY');
    expect(spread.regularHours).toBeCloseTo(1, 5);
    expect(spread.wages).toBe(1 * 1500);

    // Gross should include spread wages on top of base wages + tips
    const baseGross = 19 * 1500 + 9000 + 1500; // from previous test
    expect(emp.totals.gross).toBe(baseGross + 1500);
  });

  it('computes overtime wages when weekly hours exceed threshold and excludes spread when spreadRequired is false', () => {
    // Build a 5-day week: total 45h (40 regular + 5 OT), with one 12h day triggering spread
    const uid = 'u2';
    const name = 'Bob';
    const roleId = '1';
    const roleName = 'Server';
    const payRate = 2000; // cents/hour

    const days = [
      { date: '2025-10-06', hours: 9, ccTips: 2000, cashTips: 500, serviceCharge: 0 },
      { date: '2025-10-07', hours: 8, ccTips: 2000, cashTips: 500, serviceCharge: 0 },
      { date: '2025-10-08', hours: 8, ccTips: 2000, cashTips: 500, serviceCharge: 0 },
      { date: '2025-10-09', hours: 8, ccTips: 2000, cashTips: 500, serviceCharge: 0 },
      { date: '2025-10-10', hours: 12, ccTips: 2000, cashTips: 500, serviceCharge: 0 }, // >=10h spread day
    ];

    const daysNodes = days.map((d) => ({
      date: d.date,
      totals: {
        hours: d.hours,
        ccTips: d.ccTips,
        cashTips: d.cashTips,
        serviceCharge: d.serviceCharge,
      },
    }));

    const employeesNodes = days.map((d) => ({
      date: d.date,
      employeeUid: uid,
      displayName: name,
      totals: {
        hours: d.hours,
        ccTips: d.ccTips,
        cashTips: d.cashTips,
        serviceCharge: d.serviceCharge,
      },
      segments: [
        {
          roleId: roleId,
          roleName: roleName,
          payRate,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          hours: d.hours,
        },
      ],
      reconciliation: {},
    }));

    const timeClockEventsByEmpKey: Record<string, Array<any>> = {
      [uid]: days.map((d) => ({
        payType: 'HOURLY',
        roleId: roleId,
        roleName: roleName,
        clockIn: `${d.date}T09:00:00Z`,
        hours: d.hours,
      })),
    };

    const reconciled = {
      days: daysNodes,
      employees: employeesNodes,
      meta: { minimumWage: 1500, timeClockEventsByEmpKey },
    } as any;

    const result = summarizeWeekly(
      reconciled,
      { startDate: '2025-10-06', endDate: '2025-10-12' },
      { spreadRequired: false },
    );

    const emp = result.employees[0];
    const roleSummary = emp.hoursByRole[roleId];

    // 40h regular + 5h OT
    expect(roleSummary.regularHours).toBeCloseTo(40, 5);
    expect(roleSummary.overtimeHours).toBeCloseTo(5, 5);

    // Wages = 40*2000 + 5*2000*1.5 = 95,000
    expect(roleSummary.wages).toBe(95000);

    // Tips sum over 5 days
    expect(emp.totals.ccTips).toBe(2000 * 5);
    expect(emp.totals.cashTips).toBe(500 * 5);

    // Gross excludes spread wages when spreadRequired is false
    expect(emp.totals.gross).toBe(95000 + 2000 * 5 + 500 * 5);
  });
});
