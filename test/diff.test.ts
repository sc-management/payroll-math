import { describe, it, expect } from 'vitest';
import { buildDiff } from '../src/orchestrator/diff';
import { makeEmployee, makePeriod, makeState, P1, P2 } from './helpers/factories';

describe('buildDiff (real implementation)', () => {
  it('detects meta field changes', () => {
    const before = makeState({
      meta: {
        payrollId: 'pid',
        locationId: '1',
        locationName: 'Newton',
        minPayRate: 1500,
        startDateISO: '2025-09-22T00:00:00Z',
        endDateISO: '2025-09-28T23:59:59Z',
        totalCashTips: 100,
        totalTips: 300,
      },
    });
    const after = makeState({
      meta: {
        payrollId: 'pid',
        locationId: '1',
        locationName: 'Newton',
        minPayRate: 1500,
        startDateISO: '2025-09-22T00:00:00Z',
        endDateISO: '2025-09-28T23:59:59Z',
        totalCashTips: 150,
        totalTips: 400,
      },
    });

    const diff = buildDiff(before, after, {
      periods: new Set(),
      employees: new Set(),
      roles: new Set(),
    });

    expect(diff.meta).toEqual({
      totalCashTips: { before: 100, after: 150 },
      totalTips: { before: 300, after: 400 },
    });
  });

  it('detects period field differences only within affected periods', () => {
    const before = makeState({
      periods: {
        [P1]: makePeriod({ id: P1, sales: 1000, ccTips: 200, cashTips: 100, serviceCharge: 0 }),
        [P2]: makePeriod({ id: P2, sales: 2000, ccTips: 100, cashTips: 50, serviceCharge: 0 }),
      },
    });
    const after = makeState({
      periods: {
        [P1]: makePeriod({ id: P1, sales: 1200, ccTips: 250, cashTips: 100, serviceCharge: 0 }),
        [P2]: makePeriod({ id: P2, sales: 2000, ccTips: 100, cashTips: 55, serviceCharge: 0 }),
      },
    });

    const diff = buildDiff(before, after, {
      periods: new Set([P1]), // only P1 is affected
      employees: new Set(),
      roles: new Set(),
    });

    // should only include changed fields for P1
    expect(diff.periods).toEqual(
      expect.arrayContaining([
        { periodId: P1, field: 'sales', before: 1000, after: 1200 },
        { periodId: P1, field: 'ccTips', before: 200, after: 250 },
      ]),
    );

    // should NOT include P2 changes even though there was one
    expect(diff.periods.find((p) => p.periodId === P2)).toBeUndefined();
  });

  it('detects employee cell diffs and handles undefined cells', () => {
    const before = makeState({
      employees: [
        makeEmployee({
          uid: '1',
          roleName: 'Server',
          byPeriod: { [P1]: { hour: 5, cc: 10, cash: 5, percent: 0 } },
        }),
        makeEmployee({ uid: '2', roleName: 'Server' }), // no cell initially
      ],
    });
    const after = makeState({
      employees: [
        makeEmployee({
          uid: '1',
          roleName: 'Server',
          byPeriod: { [P1]: { hour: 6, cc: 0, cash: 5, percent: 0 } },
        }),
        makeEmployee({
          uid: '2',
          roleName: 'Server',
          byPeriod: { [P1]: { hour: 2, cc: 1, cash: 0, percent: 0 } },
        }),
      ],
    });

    const affected = {
      periods: new Set([P1]),
      employees: new Set([`${P1}:1:Server`, `${P1}:2:Server`]),
      roles: new Set(['Server']),
    };

    const diff = buildDiff(before, after, affected);

    // uid=1: hour 5→6, cc 10→0
    expect(diff.employees).toEqual(
      expect.arrayContaining([
        { periodId: P1, uid: '1', roleName: 'Server', field: 'hour', before: 5, after: 6 },
        { periodId: P1, uid: '1', roleName: 'Server', field: 'cc', before: 10, after: 0 },
      ]),
    );

    // uid=2: cell newly created
    expect(diff.employees).toEqual(
      expect.arrayContaining([
        { periodId: P1, uid: '2', roleName: 'Server', field: 'hour', before: undefined, after: 2 },
        { periodId: P1, uid: '2', roleName: 'Server', field: 'cc', before: undefined, after: 1 },
      ]),
    );
  });

  it('returns empty arrays when before===after or affected empty', () => {
    const state = makeState({
      periods: { [P1]: makePeriod({ id: P1, sales: 1000, cashTips: 100 }) },
      employees: [makeEmployee({ uid: '1', roleName: 'Server' })],
    });
    const diff = buildDiff(state, state, {
      periods: new Set(),
      employees: new Set(),
      roles: new Set(),
    });
    expect(diff).toEqual({ periods: [], employees: [], meta: {} });
  });
});
