import { describe, it, expect } from 'vitest';

import {
  canonicalizeSnapshot,
  canonicalizePayRate,
  fromCanonicalToState,
  fromBackendSnapshotToState,
} from '../src/state/from-backend';
import { RawPayRateRecord, RawPayrollWithFull } from '../src/types/backend-raw';
import { PayRateRecord, PayrollSnapshot } from '../src'; // ← 路径按你的文件实际调整

// ---------- Fixtures ----------
function makeRaw(): RawPayrollWithFull {
  return {
    id: 3567,
    location_id: 1,
    start_date: new Date('2025-09-21T20:00:00-04:00'),
    end_date: new Date('2025-09-27T20:00:00-04:00'),
    total_cash_tips: 123.45,
    total_tips: 987.65,
    periodRecords: [
      {
        id: 1,
        payroll_id: 3567,
        period_id: 1,
        sales: 1000.12,
        cash_tips: 10.23,
        cc_tips: 20.34,
        sc: 5.67,
        bus_percent: 0.055,
      },
    ],
    employeeRecords: [
      {
        id: 11,
        uid: 101,
        payroll_id: 3567,
        period_id: 1,
        role_id: 1,
        role_name: 'Server',
        pay_rate: 20.5,
        pay_type: 1,
        hour: 10,
        tips_cc: 100.0,
        tips_cash: 50.0,
        percent: 0.1,
      },
      {
        // 无 pay_rate / pay_type / role_name，也应兜底
        id: 12,
        uid: 102,
        payroll_id: 3567,
        period_id: 1,
        role_id: 2,
        role_name: null,
        pay_rate: null,
        pay_type: null,
        hour: 5.5,
        tips_cc: 10,
        tips_cash: 5,
        percent: 1.2, // >1，后续应 clamp 到 1
      },
      {
        // 非允许的 role，应被过滤
        id: 13,
        uid: 103,
        payroll_id: 3567,
        period_id: 1,
        role_id: 999,
        role_name: 'Other',
        pay_rate: 30,
        pay_type: 1,
        hour: 8,
        tips_cc: 0,
        tips_cash: 0,
        percent: 0,
      },
    ],
    location: {
      id: 1,
      name: 'Newton',
      min_pay_rate: 15.25,
    },
    logs: [
      {
        type: 2,
        update_data: JSON.stringify({ period_id: 1, sales: 1100 }),
        timestamp: new Date('2025-09-22T10:00:00Z'),
        member: { first_name: 'John', last_name: 'Doe' },
      },
      {
        type: 3,
        update_data: '{"uid":"101","cc":200}',
        timestamp: new Date('2025-09-22T11:00:00Z'),
        member: { first_name: 'Jane', last_name: 'Smith' },
      },
    ],
  };
}

function makeRawRates(): RawPayRateRecord[] {
  return [
    {
      id: 1,
      uid: 101,
      role_id: 1,
      location_id: 1,
      pay_rate: 20.5,
      pay_type: 1,
      role: { id: 1, name: 'Server' },
      member: { uid: 101, first_name: 'Alice', last_name: 'A' },
    },
    {
      id: 2,
      uid: 102,
      role_id: 2,
      location_id: 1,
      pay_rate: 16,
      pay_type: 1,
      role: { id: 2, name: 'Busser' },
      member: { uid: 102, first_name: 'Bob', last_name: 'B' },
    },
    {
      // 不在 1..4 的 role，不应该影响“预埋”
      id: 3,
      uid: 103,
      role_id: 999,
      location_id: 1,
      pay_rate: 30,
      pay_type: 1,
      role: { id: 999, name: 'Other' },
      member: { uid: 103, first_name: 'X', last_name: 'Y' },
    },
  ];
}

// ---------- Tests ----------
describe('canonicalizePayRate', () => {
  it('transforms RawPayRateRecord -> PayRateRecord with stringified ids', () => {
    const raw = makeRawRates()[0];
    const pr = canonicalizePayRate(raw);
    const expected: PayRateRecord = {
      id: String(raw.id),
      uid: String(raw.uid),
      roleId: String(raw.role_id),
      locationId: String(raw.location_id),
      payRate: raw.pay_rate,
      payType: raw.pay_type,
      role: { id: String(raw.role.id), name: raw.role.name },
      member: {
        uid: String(raw.member.uid),
        firstName: raw.member.first_name,
        lastName: raw.member.last_name,
      },
    };
    expect(pr).toEqual(expected);
  });
});

describe('canonicalizeSnapshot', () => {
  it('transforms RawPayrollWithFull -> PayrollSnapshot (ids to strings, dates to ISO, fields renamed)', () => {
    const raw = makeRaw();
    const snap = canonicalizeSnapshot(raw);

    const isoStart = raw.start_date.toISOString();
    const isoEnd = raw.end_date.toISOString();

    const expected: PayrollSnapshot = {
      id: String(raw.id),
      locationId: String(raw.location_id),
      startDate: isoStart,
      endDate: isoEnd,
      totalCashTips: raw.total_cash_tips,
      totalTips: raw.total_tips,
      periodRecords: [
        {
          id: '1',
          payrollId: String(raw.periodRecords[0].payroll_id),
          periodId: String(raw.periodRecords[0].period_id),
          sales: raw.periodRecords[0].sales,
          cashTips: raw.periodRecords[0].cash_tips,
          ccTips: raw.periodRecords[0].cc_tips,
          serviceCharge: raw.periodRecords[0].sc,
          busserPercent: raw.periodRecords[0].bus_percent,
        },
      ],
      employeeRecords: [
        {
          id: '11',
          uid: '101',
          payrollId: String(raw.employeeRecords[0].payroll_id),
          periodId: String(raw.employeeRecords[0].period_id),
          roleId: String(raw.employeeRecords[0].role_id),
          roleName: raw.employeeRecords[0].role_name!,
          payRate: raw.employeeRecords[0].pay_rate!,
          payType: raw.employeeRecords[0].pay_type!,
          hour: raw.employeeRecords[0].hour!,
          tipsCc: raw.employeeRecords[0].tips_cc!,
          tipsCash: raw.employeeRecords[0].tips_cash!,
          percent: raw.employeeRecords[0].percent!,
        },
        {
          id: '12',
          uid: '102',
          payrollId: String(raw.employeeRecords[1].payroll_id),
          periodId: String(raw.employeeRecords[1].period_id),
          roleId: String(raw.employeeRecords[1].role_id),
          roleName: 'Unknown', // null → 'Unknown'
          payRate: 0, // null → 0
          payType: 1, // null → 1 (默认)
          hour: raw.employeeRecords[1].hour!,
          tipsCc: raw.employeeRecords[1].tips_cc!,
          tipsCash: raw.employeeRecords[1].tips_cash!,
          percent: raw.employeeRecords[1].percent!,
        },
        {
          id: '13',
          uid: '103',
          payrollId: String(raw.employeeRecords[2].payroll_id),
          periodId: String(raw.employeeRecords[2].period_id),
          roleId: String(raw.employeeRecords[2].role_id),
          roleName: raw.employeeRecords[2].role_name!,
          payRate: raw.employeeRecords[2].pay_rate!,
          payType: raw.employeeRecords[2].pay_type!,
          hour: raw.employeeRecords[2].hour!,
          tipsCc: raw.employeeRecords[2].tips_cc!,
          tipsCash: raw.employeeRecords[2].tips_cash!,
          percent: raw.employeeRecords[2].percent!,
        },
      ],
      location: {
        id: String(raw.location.id),
        name: raw.location.name,
        minPayRate: raw.location.min_pay_rate,
      },
      logs: [
        {
          type: raw.logs[0].type,
          updateData: raw.logs[0].update_data,
          timestamp: raw.logs[0].timestamp.toISOString(),
          member: { firstName: 'John', lastName: 'Doe' },
        },
        {
          type: raw.logs[1].type,
          updateData: raw.logs[1].update_data,
          timestamp: raw.logs[1].timestamp.toISOString(),
          member: { firstName: 'Jane', lastName: 'Smith' },
        },
      ],
    };

    expect(snap).toEqual(expected);
  });
});

describe('fromCanonicalToState', () => {
  it('converts amounts to cents, clamps ratios, buckets employees by allowed roles, parses logs JSON', () => {
    const raw = makeRaw();
    const snap = canonicalizeSnapshot(raw);
    const rates = makeRawRates().map(canonicalizePayRate);

    const state = fromCanonicalToState(snap, rates);

    // meta → cents
    expect(state.meta).toMatchObject({
      payrollId: String(raw.id),
      locationId: String(raw.location_id),
      locationName: raw.location.name,
      minPayRate: 1525, // 15.25 → 1525
      startDateISO: raw.start_date.toISOString(),
      endDateISO: raw.end_date.toISOString(),
      totalCashTips: 12345, // 123.45 → 12345
      totalTips: 98765, // 987.65 → 98765
    });

    // periods → cents & clamp busserPercent
    expect(state.periods['1']).toEqual({
      id: '1',
      sales: 100012, // 1000.12 → 100012
      cashTips: 1023, // 10.23 → 1023
      ccTips: 2034, // 20.34 → 2034
      serviceCharge: 567, // 5.67 → 567
      busserPercent: 0.055,
    });

    // employees：仅 1..4 允许的 role，且先按 payRates 预埋（这里我们最终只关心最后的合并结果）
    const all = state.employees;
    // 103 的 role_id=999 被过滤，不在列表
    expect(all.map((e) => e.uid)).toEqual(['101', '102']);

    const emp101 = all.find((e) => e.uid === '101')!;
    expect(emp101).toMatchObject({
      roleId: '1',
      roleName: 'Server',
      name: 'Alice A', // 来自 payRates 预埋
      payRate: 2050, // 20.5 → 2050
      payType: 'HOURLY',
    });

    const emp102 = all.find((e) => e.uid === '102')!;
    expect(emp102).toMatchObject({
      roleId: '2',
      roleName: 'Busser',
      name: 'Bob B', // payRates 预埋名字
      payRate: 1600, // payRates 覆盖 16 → 1600
      payType: 'HOURLY',
    });

    // byPeriod 单元格：金额转 cents、百分比 clamp
    const c101p1 = emp101.byPeriod['1'];
    expect(c101p1).toMatchObject({
      // ⚠️ 这里“hour 应保持原值（非 cents）”。当前实现用了 floatToCents，会导致 10 → 1000。
      // 我们按“期望逻辑”断言小时不变：如果这条失败，请修复实现里对 hour 的转换。
      hour: 10,
      cc: 10000,
      cash: 5000,
      percent: 0.1,
    });

    const c102p1 = emp102.byPeriod['1'];
    expect(c102p1).toMatchObject({
      hour: 5.5,
      cc: 1000,
      cash: 500,
      percent: 1, // 1.2 → clamp 到 1
    });

    // logs JSON 解析 & 操作人名拼接
    expect(state.logs).toHaveLength(2);
    expect(state.logs[0]).toMatchObject({
      type: 2,
      operatorName: 'John Doe',
      raw: { period_id: 1, sales: 1100 },
    });
    expect(state.logs[1]).toMatchObject({
      type: 3,
      operatorName: 'Jane Smith',
      raw: { uid: '101', cc: 200 },
    });
  });
});

describe('fromBackendSnapshotToState (integration)', () => {
  it('wires canonicalizeSnapshot + canonicalizePayRate + fromCanonicalToState together', () => {
    const raw = makeRaw();
    const rawRates = makeRawRates();
    const state = fromBackendSnapshotToState(raw, rawRates);

    // 采样几个关键点，证明整个链路工作
    expect(state.meta.locationName).toBe('Newton');
    expect(state.periods['1'].sales).toBe(100012);
    expect(state.employees.find((e) => e.uid === '101')?.payRate).toBe(2050);
    expect(state.logs[0].operatorName).toBe('John Doe');
  });
});
