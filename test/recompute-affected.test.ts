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

    recomputeAffected(state, inputAffected);

    // e1: before 有 cc=10/cash=5，新结果=0/0 => 写入并计入
    // e2: before 不存在且新结果=0/0 => 不创建、不计入
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

    recomputeAffected(state, {
      periods: new Set([P1]),
      employees: new Set([`${P1}:1:Server`]),
      roles: new Set<string>(),
    });

    // mock 规则: cc = 10%*ccPoolAfterOthers(=1000) = 100；cash = 5%*cashPoolAfterOthers(=500) = 25
    expect(state.employees[0].byPeriod[P1].cc).toBe(100);
    expect(state.employees[0].byPeriod[P1].cash).toBe(25);
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
    recomputeAffected(state, {
      periods: new Set([P1]),
      employees: new Set([`${P1}:20:Server`]),
      roles: new Set<string>(),
    });

    // ccPoolAfterOthers = 1000 - hostTotalCcTips(=300) = 700 -> 10% = 70
    expect(state.employees[1].byPeriod[P1].cc).toBe(70);
  });

  it('period 未入 affected，但能从 state 读取该 period 的池子并按候选员工 key 进行重算', () => {
    const host = makeEmployee({
      uid: '10',
      roleName: 'Host',
      byPeriod: { [P1]: makeCell({ cc: 200, cash: 0 }) }, // 先占用 200
    });
    const server = makeEmployee({
      uid: '20',
      roleName: 'Server',
      byPeriod: { [P1]: makeCell({ cc: 0, cash: 0 }) },
    });
    const busserNoCell = makeEmployee({ uid: '30', roleName: 'Busser' }); // 没有 cell，不应被创建
    const state = makeState({
      periods: { [P1]: makePeriod({ ccTips: 1000, cashTips: 500, serviceCharge: 0 }) },
      employees: [host, server, busserNoCell],
    });

    // 注意：这里 periods 传空集合，只有 employees 集合里带着 `${P1}:uid:role`
    recomputeAffected(state, {
      periods: new Set<string>(),
      employees: new Set([`${P1}:20:Server`]), // ✅ 只给 Server
      roles: new Set<string>(),
    });

    // 根据我们上面的 mock：cc=10%*(ccPoolAfterOthers)
    // ccPoolAfterOthers = 1000 - host.cc(=200) = 800 => Server cc = 80
    // cash=5%*(cashPoolAfterOthers)；Host.cash=0，所以 cashPoolAfterOthers=500 => Server cash=25
    expect(state.employees[1].byPeriod[P1].cc).toBe(80);
    expect(state.employees[1].byPeriod[P1].cash).toBe(25);
    // 没有 cell 的 Busser 不应被创建
    expect(state.employees[2].byPeriod[P1]).toBeUndefined();
  });

  it('period 未入 affected + Host 本次也在候选里：先写 Host，再按 afterOthers 重算 Server（顺序已保证）', () => {
    const host = makeEmployee({
      uid: '10',
      roleName: 'Host',
      byPeriod: { [P1]: makeCell({ cc: 0, cash: 0 }) }, // 初始 0，本轮会被写入
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

    // 只传 employees（不含 periods）
    recomputeAffected(state, {
      periods: new Set<string>(),
      employees: new Set([`${P1}:10:Host`, `${P1}:20:Server`]),
      roles: new Set<string>(),
    });

    // 第一步：根据 mock，Host 从 pool 拿 10% => 100（cash 0）
    expect(state.employees[0].byPeriod[P1].cc).toBe(100);

    // 第二步：Server 再从「扣除 Host 后」的池子拿 10%
    // 剩余 ccPoolAfterOthers = 1000 - 100 = 900 => 10% = 90
    expect(state.employees[1].byPeriod[P1].cc).toBe(90);
  });
});
