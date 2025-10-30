import { describe, it, expect, vi, beforeEach } from 'vitest';

// 先 mock calcEmployee，确保在被测文件 import 之前
vi.mock('../src/core/calcEmployee', () => {
  return {
    calculateEmployee: vi.fn((args: any) => {
      // 简单规则：返回当前 poolAfterOthers 的 10% 给 cc，5% 给 cash，再加上当前 cell 的手改值
      const ccBase = Math.floor((args.ccPoolAfterOthers ?? 0) * 0.1);
      const cashBase = Math.floor((args.cashPoolAfterOthers ?? 0) * 0.05);
      return {
        tipsCc: ccBase, // 忽略 args.cc 手改，便于测试“是否变化”
        tipsCash: cashBase,
        total: ccBase + cashBase,
      };
    }),
  };
});

import { recomputeAffected } from '../src/orchestrator/recompute';
import { makeEmployee, makeState, makePeriod, makeCell, P1 } from './helpers/factories';

describe('recomputeAffected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('只处理候选 employees；不变则不写 & 不计入 affected', () => {
    const e1 = makeEmployee({
      uid: '1',
      roleName: 'Server',
      byPeriod: { [P1]: makeCell({ cc: 10, cash: 5 }) },
    });
    const e2 = makeEmployee({ uid: '2', roleName: 'Server' }); // 没有 cell
    const state = makeState({
      periods: { [P1]: makePeriod({ ccTips: 0, cashTips: 0, serviceCharge: 0 }) },
      employees: [e1, e2],
    });

    // 由于 pool=0，mock 的结果 tipsCc=0, tipsCash=0
    const inputAffected = {
      periods: new Set([P1]),
      employees: new Set([`${P1}:1:Server`, `${P1}:2:Server`]),
      roles: new Set<string>(),
    };

    const out = recomputeAffected(state, inputAffected);

    // e1: before 有 cc=10/cash=5，新结果=0/0 => 写入并计入
    // e2: before 不存在且新结果=0/0 => 不创建、不计入
    expect(out.employees).toEqual(new Set([`${P1}:1:Server`]));
    expect(state.employees[0].byPeriod[P1].cc).toBe(0);
    expect(state.employees[0].byPeriod[P1].cash).toBe(0);
    expect(state.employees[1].byPeriod[P1]).toBeUndefined();
  });

  it('当 pool 非零时会写入新值并计入 affected', () => {
    const e1 = makeEmployee({
      uid: '1',
      roleName: 'Server',
      byPeriod: { [P1]: makeCell({ cc: 0, cash: 0 }) },
    });
    const state = makeState({
      periods: { [P1]: makePeriod({ ccTips: 1000, cashTips: 500, serviceCharge: 0 }) },
      employees: [e1],
    });

    const out = recomputeAffected(state, {
      periods: new Set([P1]),
      employees: new Set([`${P1}:1:Server`]),
      roles: new Set<string>(),
    });

    // mock 规则: cc = 10%*ccPoolAfterOthers(=1000) = 100；cash = 5%*cashPoolAfterOthers(=500) = 25
    expect(state.employees[0].byPeriod[P1].cc).toBe(100);
    expect(state.employees[0].byPeriod[P1].cash).toBe(25);
    expect(out.employees).toEqual(new Set([`${P1}:1:Server`]));
    expect(out.periods).toEqual(new Set([P1]));
    expect(out.roles.has('Server')).toBe(true);
  });

  it('Host/Bartender 的占用从当前 draft 汇总读取（顺序已保证）', () => {
    // 先给 Host 一个直接写入的 cc（模拟先前角色顺序计算完毕）
    const host = makeEmployee({
      uid: '10',
      roleName: 'Host',
      byPeriod: { [P1]: makeCell({ cc: 300, cash: 0 }) },
    });
    const server = makeEmployee({
      uid: '20',
      roleName: 'Server',
      byPeriod: { [P1]: makeCell({ cc: 0, cash: 0 }) },
    });
    const state = makeState({
      periods: { [P1]: makePeriod({ ccTips: 1000, cashTips: 0, serviceCharge: 0 }) },
      employees: [host, server],
    });

    // 只把 Server 作为候选，Host的 300 会被当成“others”扣除
    const out = recomputeAffected(state, {
      periods: new Set([P1]),
      employees: new Set([`${P1}:20:Server`]),
      roles: new Set<string>(),
    });

    // ccPoolAfterOthers = 1000 - hostTotalCcTips(=300) = 700 -> 10% = 70
    expect(state.employees[1].byPeriod[P1].cc).toBe(70);
    expect(out.employees).toEqual(new Set([`${P1}:20:Server`]));
  });
});
