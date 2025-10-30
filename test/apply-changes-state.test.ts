import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEmployee, makePeriod, makeState, P1, P2 } from './helpers/factories';

// stub diff：只做极简 before/after 比较，确保 applyChangesState 会调用并传入受影响范围
vi.mock('../src/orchestrator/diff', () => ({
  buildDiff: vi.fn((before, after) => {
    return {
      periods: [],
      employees: [],
      meta: {
        totalCashTips: { before: before.meta.totalCashTips, after: after.meta.totalCashTips },
        totalTips: { before: before.meta.totalTips, after: after.meta.totalTips },
      },
    };
  }),
}));

import { applyChangesState } from '../src/orchestrator/applyChanges';

// calcEmployee 不参与 applyChangesState（此处只验证 totals & 受影响集合透传），可不 mock
describe('applyChangesState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('period 变更会重算 meta totals，并返回 affected/diff', () => {
    const state = makeState({
      periods: {
        [P1]: makePeriod({ id: P1, cashTips: 100, ccTips: 200 }),
        [P2]: makePeriod({ id: P2, cashTips: 50, ccTips: 50 }),
      },
      employees: [makeEmployee({ uid: '1', roleName: 'Server' })],
    });

    const { next, affected, diff } = applyChangesState(state, [
      { kind: 'period', periodId: P1, field: 'cashTips', value: 300 }, // 从100 -> 300
    ]);

    // totals: cash=300+50=350, cc=200+50=250, totalTips=600
    expect(next.meta.totalCashTips).toBe(350);
    expect(next.meta.totalTips).toBe(600);

    // affected 由 resolveDependencies 决定：period 级会包含 P1、并把 Server/Busser 加进去（当前只有 Server）
    expect(affected.periods.has(P1)).toBe(true);
    expect([...affected.employees]).toContain(`${P1}:1:Server`);
    expect(affected.roles.has('Server')).toBe(true);

    // diff.meta 被 stub 构造、
    expect(diff.meta.totalCashTips?.after).toBe(350);
    expect(diff.meta.totalTips?.after).toBe(600);
  });

  it('employee 变更（percent clamp）通过 normalize 生效', () => {
    const state = makeState({
      periods: { [P1]: makePeriod({ id: P1 }) },
      employees: [makeEmployee({ uid: '1', roleName: 'Server' })],
    });

    const { next } = applyChangesState(state, [
      { kind: 'employee', periodId: P1, uid: '1', roleName: 'Server', field: 'percent', value: 5 }, // 会被 clamp01
    ]);

    expect(next.employees[0].byPeriod[P1].percent).toBe(1);
  });
});
