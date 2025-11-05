import { describe, it, expect } from 'vitest';
import { addDays, formatISO, isValid, parseISO } from 'date-fns';

import { makeCurrentSheetAdapterDate, PayrollState } from '../src';
import {
  defaultPeriodToDate,
  PeriodToDateResolver,
} from '../src/reconcile/adapters/current-sheet-adapter';
import { makeEmployee, makeState } from './helpers/factories';

// 简化 MoneyCents：项目里是品牌类型，这里按 number 用
type MC = number;

const START = '2025-10-06T00:00:00.000Z'; // 星期一
const toISODate = (d: Date) => formatISO(d, { representation: 'date' });

describe('defaultPeriodToDate', () => {
  it('每两个 periodId 映射到同一天；(n-1)/2 向下取整推进日期', () => {
    const meta = { startDateISO: START } as PayrollState['meta'];
    const d1 = defaultPeriodToDate('1', meta);
    const d2 = defaultPeriodToDate('2', meta);
    const d3 = defaultPeriodToDate('3', meta);
    const d4 = defaultPeriodToDate('4', meta);

    // 1 和 2 在同一天
    expect(d1).toBe(d2);

    // 3 和 4 在同一天
    expect(d3).toBe(d4);

    // 第二天 = 第一天天后移 1 天
    const base = parseISO(d1);
    expect(isValid(base)).toBe(true);
    const next = toISODate(addDays(base, 1));
    expect(d3).toBe(next);
  });

  it('对非法 startDateISO 或 pid 抛错', () => {
    const badMeta = { startDateISO: 'bad' } as PayrollState['meta'];
    expect(() => defaultPeriodToDate('1', badMeta)).toThrow();

    const meta = { startDateISO: START } as PayrollState['meta'];
    expect(() => defaultPeriodToDate('0', meta)).toThrow();
    expect(() => defaultPeriodToDate('abc', meta)).toThrow();
  });
});

describe('makeCurrentSheetAdapterDate（稳态行为）', () => {
  const adapter = makeCurrentSheetAdapterDate();

  it('listDates：来自 periods 与 employees.byPeriod 的日期并集，排序后返回', () => {
    const state = makeState({
      periods: {
        '1': { ccTips: 0, cashTips: 0, serviceCharge: 0 } as any,
        '3': { ccTips: 0, cashTips: 0, serviceCharge: 0 } as any,
      },
      employees: [
        {
          uid: 'E1',
          name: 'Alice',
          roleId: 10,
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          byPeriod: { '4': { hour: 5, cc: 0, cash: 0 } },
        } as any,
      ],
    });

    const dates = adapter.listDates(state);

    // 期望集：用实现同一 resolver 计算
    const expectedSet = new Set<string>([
      defaultPeriodToDate('1', state.meta),
      defaultPeriodToDate('3', state.meta),
      defaultPeriodToDate('4', state.meta),
    ]);
    const expected = Array.from(expectedSet).sort();

    expect(dates).toEqual(expected);
  });

  it('getDayTotals：金额来自 periods 按日期累加；hours 来自 employees.byPeriod 按日期汇总', () => {
    const state = makeState({
      periods: {
        '1': { ccTips: 100 as MC, cashTips: 50 as MC, serviceCharge: 25 as MC } as any,
        '3': { ccTips: 300 as MC, cashTips: 0 as MC, serviceCharge: 100 as MC } as any,
      },
      employees: [
        {
          uid: 'E1',
          name: 'Alice',
          roleId: 10,
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          byPeriod: {
            '1': { hour: 4, cc: 10, cash: 5 }, // 与 pid=1 同日
            '2': { hour: 2, cc: 0, cash: 0 }, // 与 pid=1 同日（1/2 同天）
            '4': { hour: 3, cc: 2, cash: 1 }, // 与 pid=3 同日（3/4 同天）
          },
        } as any,
        {
          uid: 'E2',
          name: 'Bob',
          roleId: 20,
          roleName: 'Busser',
          payRate: 1200,
          payType: 'HOURLY',
          byPeriod: { '3': { hour: 6, cc: 0, cash: 0 } }, // 与 periods[3] 同日
        } as any,
      ],
    });

    // 选两个目标日期：pid=1 所在日、pid=3 所在日
    const day1 = defaultPeriodToDate('1', state.meta);
    const day2 = defaultPeriodToDate('3', state.meta);

    // 用相同规则手工累加，避免硬编码具体日期
    const sumPeriodsFor = (date: string) => {
      let cc = 0 as MC,
        cash = 0 as MC,
        svc = 0 as MC;
      for (const [pid, p] of Object.entries(state.periods ?? {})) {
        if (defaultPeriodToDate(pid, state.meta) === date) {
          cc += (p as any).ccTips ?? 0;
          cash += (p as any).cashTips ?? 0;
          svc += (p as any).serviceCharge ?? 0;
        }
      }
      return { cc, cash, svc };
    };
    const sumHoursFor = (date: string) => {
      let h = 0;
      for (const emp of state.employees ?? []) {
        for (const [pid, cell] of Object.entries((emp as any).byPeriod ?? {})) {
          if (defaultPeriodToDate(pid, state.meta) === date) {
            h += (cell as any).hour ?? 0;
          }
        }
      }
      return h;
    };

    const t1 = adapter.getDayTotals(state, day1);
    const P1 = sumPeriodsFor(day1);
    expect(t1).toEqual({
      hours: sumHoursFor(day1),
      ccTips: P1.cc,
      cashTips: P1.cash,
      serviceCharge: P1.svc,
    });

    const t2 = adapter.getDayTotals(state, day2);
    const P2 = sumPeriodsFor(day2);
    expect(t2).toEqual({
      hours: sumHoursFor(day2),
      ccTips: P2.cc,
      cashTips: P2.cash,
      serviceCharge: P2.svc,
    });
  });

  it('listEmployeeDayRows：同一天按 roleName 合并 segment；全 0 cell 跳过；稳定排序', () => {
    const state = makeState({
      employees: [
        makeEmployee({
          uid: 'E1',
          name: '', // 触发 displayName 回填为 uid
          roleId: '1',
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          byPeriod: {
            '1': { hour: 3, cc: 5, cash: 0, percent: 0 }, // 基础段
            '2': { hour: 2, cc: 0, cash: 1, percent: 0 }, // 与 1 同日，应合并
            '3': { hour: 0, cc: 0, cash: 0, percent: 0 }, // 全 0，跳过
          },
        }),
        makeEmployee({
          uid: 'E2',
          name: 'Bob',
          roleId: '2',
          roleName: 'Busser',
          payRate: 1200,
          payType: 'HOURLY',
          byPeriod: { '1': { hour: 4, cc: 0, cash: 0, percent: 0 } },
        }),
      ],
    });

    const rows = adapter.listEmployeeDayRows(state);
    const day1 = defaultPeriodToDate('1', state.meta);

    // 只应有 day1 的两行，按 (date, uid) 升序
    expect(rows.map((r) => r.date)).toEqual([day1, day1]);
    expect(rows.map((r) => r.employeeUid)).toEqual(['E1', 'E2']);

    const r1 = rows[0];
    const r2 = rows[1];

    expect(r1.displayName).toBe('E1'); // name 空 => 用 uid
    expect(r2.displayName).toBe('Bob');

    // E1: Server 段合并 pid1+pid2
    expect(r1.segments).toHaveLength(1);
    expect(r1.segments![0]).toMatchObject({
      roleName: 'Server',
      hours: 3 + 2,
      ccTips: 5,
      cashTips: 1,
      position: 'FRONT_OF_HOUSE',
    });

    // E2: Busser 段
    expect(r2.segments).toHaveLength(1);
    expect(r2.segments![0]).toMatchObject({
      roleName: 'Busser',
      hours: 4,
      ccTips: 0,
      cashTips: 0,
    });
  });

  it('支持自定义 periodIdToDate resolver；其行为应完整体现在三个方法中', () => {
    const custom: PeriodToDateResolver = (pid, meta) => {
      // 奇数 pid -> Day-0；偶数 pid -> Day-1（仅用于测试）
      const base = parseISO(meta.startDateISO);
      const offset = Number(pid) % 2 === 0 ? 1 : 0;
      return toISODate(addDays(base, offset));
    };
    const a2 = makeCurrentSheetAdapterDate({ periodIdToDate: custom });

    const state = makeState({
      periods: {
        '1': { ccTips: 100 as MC, cashTips: 0 as MC, serviceCharge: 0 as MC } as any,
        '2': { ccTips: 200 as MC, cashTips: 0 as MC, serviceCharge: 0 as MC } as any,
      },
      employees: [
        {
          uid: 'E1',
          name: 'Alice',
          roleId: 10,
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          byPeriod: { '3': { hour: 2, cc: 0, cash: 0 }, '4': { hour: 5, cc: 0, cash: 0 } },
        } as any,
      ],
    });

    const dates = a2.listDates(state);
    const expected = Array.from(
      new Set<string>([
        custom('1', state.meta),
        custom('2', state.meta),
        custom('3', state.meta),
        custom('4', state.meta),
      ]),
    ).sort();
    expect(dates).toEqual(expected);

    const day0 = custom('1', state.meta); // 奇数
    const day1 = custom('2', state.meta); // 偶数

    expect(a2.getDayTotals(state, day0)).toEqual({
      hours: 2, // pid=3
      ccTips: 100 as MC, // pid=1
      cashTips: 0 as MC,
      serviceCharge: 0 as MC,
    });

    expect(a2.getDayTotals(state, day1)).toEqual({
      hours: 5, // pid=4
      ccTips: 200 as MC, // pid=2
      cashTips: 0 as MC,
      serviceCharge: 0 as MC,
    });
  });
});
