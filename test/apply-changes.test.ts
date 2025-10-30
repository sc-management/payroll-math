import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEmployee, makePeriod, makeState, P1, P2 } from './helpers/factories';

// ---- mock: diff（保留第三个参数 affected，方便断言）----
vi.mock('../src/orchestrator/diff', () => {
  return {
    buildDiff: vi.fn((before: any, after: any, affected: any) => {
      return {
        periods: [],
        employees: [],
        meta: {
          totalCashTips: { before: before.meta.totalCashTips, after: after.meta.totalCashTips },
          totalTips: { before: before.meta.totalTips, after: after.meta.totalTips },
        },
        __affectedEcho: affected, // 仅用于测试断言
      };
    }),
  };
});

// 为 period-only fallback 场景准备的 calcEmployee mock（其它用例不依赖它）
vi.mock('../src/core/calcEmployee', () => {
  return {
    calculateEmployee: vi.fn(({ ccPoolAfterOthers, cashPoolAfterOthers }) => {
      // 简单固定算法，确保非零，便于观察 cell 被创建/更新
      const cc = Math.floor((ccPoolAfterOthers ?? 0) * 0.1); // 10%
      const cash = Math.floor((cashPoolAfterOthers ?? 0) * 0.05); // 5%
      return { tipsCc: cc, tipsCash: cash, total: cc + cash };
    }),
  };
});

const { buildDiff } = await import('../src/orchestrator/diff');

// 动态导入 applyChanges，便于在不同用例前后切换模块 mock
async function importApplyChanges() {
  const mod = await import('../src');
  return mod.applyChanges as typeof import('../src').applyChanges;
}

describe('applyChanges (new resolve/recompute contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // 每个用例重新评估模块依赖（配合动态导入）
  });

  it('period 变更会重算 meta totals；affected 仅包含 resolveDependencies 的结果', async () => {
    // 使用真实 resolveDependencies
    const applyChanges = await importApplyChanges();

    const state = makeState({
      periods: {
        [P1]: makePeriod({ id: P1, cashTips: 100, ccTips: 200 }),
        [P2]: makePeriod({ id: P2, cashTips: 50, ccTips: 50 }),
      },
      employees: [makeEmployee({ uid: '1', roleName: 'Server' })], // 默认无 cell
    });

    const { next, affected, diff } = applyChanges(state, [
      { kind: 'period', periodId: P1, field: 'cashTips', value: 300 }, // 从 100 -> 300
    ]);

    // totals: cash=300+50=350, cc=200+50=250, totalTips=600
    expect(next.meta.totalCashTips).toBe(350);
    expect(next.meta.totalTips).toBe(600);

    // affected：由于该 Server 在 P1 下没有 cell 且未被直接点名，resolve 不会把它加入
    expect(affected.periods).toEqual(new Set([P1]));
    expect(affected.employees.size).toBe(0);
    expect(affected.roles.size).toBe(0);

    // diff.meta 由 stub 生成；并且 buildDiff 应该被以 (before, after, affected) 调用
    expect(diff.meta.totalCashTips?.after).toBe(350);
    expect(diff.meta.totalTips?.after).toBe(600);
    expect(vi.mocked(buildDiff).mock.calls[0][2]).toEqual(affected);
  });

  it('employee 变更（percent clamp）通过 normalize 生效', async () => {
    // 使用真实 resolveDependencies
    const applyChanges = await importApplyChanges();

    const state = makeState({
      periods: { [P1]: makePeriod({ id: P1 }) },
      employees: [makeEmployee({ uid: '1', roleName: 'Server' })],
    });

    const { next, affected } = applyChanges(state, [
      { kind: 'employee', periodId: P1, uid: '1', roleName: 'Server', field: 'percent', value: 5 }, // 会被 clamp01 → 1
    ]);

    expect(next.employees[0].byPeriod[P1].percent).toBe(1);
    // employee 的 change → 员工被加入 affected，但不把 pid 放入 periods（依据新约定）
    expect(affected.employees).toEqual(new Set([`${P1}:1:Server`]));
    expect(affected.periods.size).toBe(0);
    expect(affected.roles).toEqual(new Set(['Server']));
  });

  it('period-only fallback：resolve 返回 employees 为空但声明了角色时，recompute 仍会重算该 period 下对应角色的所有员工', async () => {
    // 针对本用例：mock resolveDependencies，让 employees 为空（只返回 period 与角色）
    vi.doMock('../src/orchestrator/resolve', () => {
      return {
        resolveDependencies: () => ({
          periods: new Set([P1]),
          employees: new Set<string>(), // 关键：空集合
          roles: new Set<string>(['Server']), // 指定该 period 涉及的角色
        }),
      };
    });
    const applyChanges = await importApplyChanges();

    const s1 = makeEmployee({
      uid: '1',
      roleName: 'Server',
      byPeriod: { [P1]: { hour: 0, cc: 0, cash: 0, percent: 0 } },
    });
    const s2 = makeEmployee({ uid: '2', roleName: 'Server' }); // 无 cell
    const state = makeState({
      periods: { [P1]: makePeriod({ id: P1, ccTips: 1000, cashTips: 500, serviceCharge: 0 }) },
      employees: [s1, s2],
    });

    const { next, affected, diff } = applyChanges(state, [
      { kind: 'period', periodId: P1, field: 'ccTips', value: 1000 }, // 触发 period 级变更
    ]);

    // 期望：尽管 affected.employees 为空，recompute 仍然会对该 period 下所有 Server 员工计算
    // calcEmployee mock：cc=10%*1000=100；cash=5%*500=25
    expect(next.employees[0].byPeriod[P1].cc).toBe(100);
    expect(next.employees[0].byPeriod[P1].cash).toBe(25);
    // s2 原本没有 cell，但新结果非 0，应被创建
    expect(next.employees[1].byPeriod[P1].cc).toBe(100);
    expect(next.employees[1].byPeriod[P1].cash).toBe(25);

    // affected 来自 resolve（不会被 recompute 补全）
    expect(affected.periods).toEqual(new Set([P1]));
    expect(affected.roles).toEqual(new Set(['Server']));
    expect(affected.employees.size).toBe(0);

    // buildDiff 第三个参数应是我们 mock 的 affected
    expect(vi.mocked(buildDiff).mock.calls[0][2]).toEqual(affected);
    expect(diff.meta.totalTips?.after).toBeTypeOf('number');
  });

  it('integration: buildDiff 的第三参与返回的 affected 一致（不依赖 recompute 产出）', async () => {
    // 使用顶部已 mock 的 buildDiff（不再动态导入 diff 模块）
    const applyChanges = await importApplyChanges();

    const state = makeState({
      periods: { [P1]: makePeriod({ id: P1, cashTips: 100, ccTips: 200 }) },
      employees: [makeEmployee({ uid: '1', roleName: 'Server' })],
    });

    const { affected } = applyChanges(state, [
      { kind: 'period', periodId: P1, field: 'cashTips', value: 300 },
    ]);

    // 直接用顶层的 buildDiff 断言第三个参数就是返回的 affected（来自 resolve）
    expect(vi.mocked(buildDiff).mock.calls[0][2]).toEqual(affected);
    expect(affected.periods.has(P1)).toBe(true);
  });
});
