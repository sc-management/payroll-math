import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fromStateToModel, PayrollModel, PayrollState } from '../src';

// ✅ Mock minimumPay
vi.mock('../src/core/minimumPay', () => ({
  applyMinimumPayAdjustment: vi.fn().mockReturnValue({
    tips: 100, // 期望被写到 totalReportingCc
    tipsCash: 50, // 期望被写到 totalReportingCash
  }),
}));

const mockedAdjust = await import('../src/core/minimumPay');

describe('fromStateToModel (Vitest)', () => {
  let baseState: PayrollState;

  beforeEach(() => {
    baseState = {
      meta: {
        payrollId: '123',
        locationId: '1',
        locationName: 'Newton',
        minPayRate: 15,
        startDateISO: '2025-09-21',
        endDateISO: '2025-09-27',
        totalCashTips: 300,
        totalTips: 500,
      },
      periods: {
        '1': {
          id: '1',
          sales: 1000,
          cashTips: 100,
          ccTips: 200,
          serviceCharge: 0,
          busserPercent: 5,
        },
      },
      employees: [
        {
          uid: 'emp1',
          roleId: 'r1',
          roleName: 'Server',
          name: 'Alice',
          payRate: 20,
          payType: 1,
          byPeriod: {
            '1': { hour: 10, cc: 100, cash: 50, total: 150, percent: 0.1 },
          },
        },
        {
          uid: 'emp2',
          roleId: 'r1',
          roleName: 'Server',
          name: 'Bob',
          payRate: 25,
          payType: 1,
          byPeriod: {
            '1': { hour: 5, cc: 50, cash: 25, total: 75, percent: 0.05 },
          },
        },
      ],
      logs: [
        // payroll log
        { type: 1, timestamp: '2025-09-22T10:00:00Z', operatorName: 'op', raw: { note: 'p' } },
        // period logs: 同时覆盖 period_id 和 periodId 两种字段
        { type: 2, timestamp: '2025-09-22T11:00:00Z', operatorName: 'op', raw: { period_id: 1 } },
        { type: 4, timestamp: '2025-09-22T12:00:00Z', operatorName: 'op', raw: { periodId: '1' } },
        // employee logs: 覆盖 type 3 与 5
        { type: 3, timestamp: '2025-09-22T13:00:00Z', operatorName: 'op', raw: { uid: 'emp1' } },
        { type: 5, timestamp: '2025-09-22T14:00:00Z', operatorName: 'op', raw: { uid: 'emp2' } },
      ],
    };
  });

  it('transforms PayrollState to PayrollModel correctly', () => {
    const result: PayrollModel = fromStateToModel(baseState);

    // meta
    expect(result.meta).toEqual({
      id: '123',
      locationId: '1',
      locationName: 'Newton',
      minPayRate: 15,
      startDate: '2025-09-21',
      endDate: '2025-09-27',
      totalCashTips: 300,
      totalTips: 500,
    });

    // blocks: 14 个周期
    expect(result.blocks).toHaveLength(14);
    expect(result.blocks[0]).toMatchObject({
      periodId: '1',
      day: 'Mon',
      meal: 'lunch',
      sales: 1000,
      cashTips: 100,
      ccTips: 200,
      serviceCharge: 0,
      tipsTotal: 200, // ccTips + serviceCharge
      busserPercent: 5,
    });
    // 未提供的周期补 0
    expect(result.blocks[1].sales).toBe(0);

    // sections：按 roleName 分桶
    expect(result.sections).toHaveLength(1);
    const server = result.sections[0];
    expect(server.roleName).toBe('Server');
    expect(server.employees.map((e) => e.uid).sort()).toEqual(['emp1', 'emp2']);

    // employee 汇总 & 最低工资调整结果写回
    const alice = server.employees.find((e) => e.uid === 'emp1')!;
    expect(alice.totalHour).toBe(10);
    expect(alice.totalCc).toBe(100); // 来自 mocked adjust
    expect(alice.totalCash).toBe(50); // 来自 mocked adjust

    // 确认调用 applyMinimumPayAdjustment 的参数
    expect((mockedAdjust as any).applyMinimumPayAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        regularHours: 10,
        overtimeHours: 0,
        payAmount: expect.any(Number),
        tips: 100,
        tipsCash: 50,
        bonus: 0,
        minPayRate: 15,
      }),
    );

    // logs：payroll / period / employee 分组
    expect(result.logs.all).toHaveLength(5);
    expect(result.logs.payroll).toHaveLength(1);

    // ✅ 注意：如果 period 分组这里报错为 undefined，请修正源码里 Number.isInteger 的判断（见上方提醒）
    expect(result.logs.period['1']).toHaveLength(2); // 来自 type 2 与 type 4 两条
    expect(result.logs.employee['emp1']).toHaveLength(1);
    expect(result.logs.employee['emp2']).toHaveLength(1);
  });

  it('handles empty employees/logs safely', () => {
    const result = fromStateToModel({ ...baseState, employees: [], logs: [] });
    expect(result.sections).toEqual([]);
    expect(Object.keys(result.logs.employee)).toHaveLength(0);
    expect(result.logs.payroll).toHaveLength(0);
    expect(Object.keys(result.logs.period)).toHaveLength(0);
  });

  it('overtime pay is included in payAmount passed to adjuster', () => {
    const heavy = structuredClone(baseState);
    // 45 小时，payRate 20 => 40*20 + 5*20*1.5 = 800 + 150 = 950，再加 cc 100
    heavy.employees = [
      {
        uid: 'emp3',
        roleId: 'r2',
        roleName: 'Runner',
        name: 'Carol',
        payRate: 20,
        payType: 1,
        byPeriod: {
          '1': { hour: 45, cc: 100, cash: 0, total: 100 },
        },
      },
    ];

    fromStateToModel(heavy);

    // 抓第一条调用参数
    const call = (mockedAdjust as any).applyMinimumPayAdjustment.mock.calls.at(-1)?.[0];
    // payAmount = 基础 + 加班 + tips(通过 result 里 totalCc 回填，这里只检查基础/加班已算入)
    // 注意：源码里是 regularHours*rate + overtimeHours*rate*1.5 + totalCc
    expect(call.regularHours).toBe(40);
    expect(call.overtimeHours).toBe(5);
    // 这里不直接断言具体 payAmount 数值，而是确保包含 cc（100）以外的工资构成
    expect(call.payAmount).toBe(40 * 20 + 5 * 20 * 1.5 + 100);
  });
});
