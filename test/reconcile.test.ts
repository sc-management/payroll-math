import { describe, it, expect } from 'vitest';
import { makeState, makeEmployee, makePeriod, P1 } from './helpers/factories';
import { ReconciledDay } from '../src';
import { SheetAdapter, SheetEmployeeDayRow } from '../src';
import { ReconcileInput } from '../src';
import { reconcilePayroll } from '../src';
import { OVERALL_ROLE_KEY } from '../src/summarize/type';

// =======================================================
// Helper：构建最小 SheetAdapter
// =======================================================
function makeAdapter(args: {
  dayTotals: Record<string, ReconciledDay['totals']>;
  empRows: SheetEmployeeDayRow[];
}): SheetAdapter {
  const dates = Object.keys(args.dayTotals);
  return {
    listDates: () => dates,
    getDayTotals: (_state, date) => args.dayTotals[date],
    listEmployeeDayRows: () => args.empRows,
  };
}

// =======================================================
// 1) 日期级对账
// =======================================================
describe('reconcilePayroll - day-level', () => {
  it('detects missing dates and negative ccTips', () => {
    const adapter = makeAdapter({
      dayTotals: {
        '2025-11-01': { hours: 10, ccTips: 10000, serviceCharge: 3000, cashTips: 2000 },
        '2025-11-02': { hours: 8, ccTips: 8000, serviceCharge: 2000, cashTips: 1000 },
      },
      empRows: [],
    });

    const state = makeState({
      periods: { [P1]: makePeriod({}) },
      employees: [],
    });

    const input: ReconcileInput = {
      payrollState: state,
      externalDailyEvents: [
        {
          date: '2025-11-01',
          employeeUid: '1',
          displayName: 'A',
          hours: 12,
          roleId: 'r1',
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          clockIn: '2025-11-01T12:00:00Z',
        },
        {
          date: '2025-11-03', // sheet 没有
          employeeUid: '2',
          displayName: 'B',
          hours: 5,
          roleId: 'r2',
          roleName: 'Busser',
          payRate: 1200,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          clockIn: '2025-11-03T12:00:00Z',
        },
      ],
      externalDailyReceipts: [
        { date: '2025-11-01', ccTips: 9000, serviceCharge: 3000 },
        { date: '2025-11-01', ccTips: -500, serviceCharge: 0 },
        { date: '2025-11-03', ccTips: 1000, serviceCharge: 0 },
      ],
    };

    const out = reconcilePayroll(input, {}, { adapter });
    const codes = out.report.issues.map((i) => i.code);

    expect(codes).toContain('SHEET_MISSING_DATE'); // 11-03
    expect(codes).toContain('EXTERNAL_MISSING_DATE'); // 11-02
    expect(codes).toContain('CLOVER_NEGATIVE_NET'); // 负ccTips
  });
});

// =======================================================
// 2) 员工×日 对账
// =======================================================
describe('reconcilePayroll - employee x day', () => {
  it('aggregates valid external records and matches roles', () => {
    const adapter = makeAdapter({
      dayTotals: {
        '2025-11-01': { hours: 0, ccTips: 0, serviceCharge: 0, cashTips: 0 },
      },
      empRows: [
        {
          date: '2025-11-01',
          employeeUid: '1',
          displayName: 'Alice',
          segments: [
            {
              roleId: '1',
              roleName: 'Server',
              position: 'FRONT_OF_HOUSE',
              payType: 'HOURLY',
              payRate: 1500,
              hours: 6,
              ccTips: 3000,
              cashTips: 1000,
            },
            {
              roleId: '2',
              roleName: 'Busser',
              position: 'FRONT_OF_HOUSE',
              payType: 'HOURLY',
              payRate: 1200,
              hours: 2,
              ccTips: 500,
              cashTips: 200,
            },
          ],
        },
      ],
    });

    const state = makeState({
      employees: [
        makeEmployee({ uid: '1', roleName: 'Server' }),
        makeEmployee({ uid: '2', roleName: 'Busser' }),
      ],
    });

    const input: ReconcileInput = {
      payrollState: state,
      externalDailyEvents: [
        {
          date: '2025-11-01',
          employeeUid: '1',
          displayName: 'Alice',
          hours: 5.25,
          roleId: '1',
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          clockIn: '2025-11-01T12:00:00Z',
        },
        {
          date: '2025-11-01',
          employeeUid: '1',
          displayName: 'Alice',
          hours: 2.75,
          roleId: '2',
          roleName: 'Busser',
          payRate: 1200,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          clockIn: '2025-11-01T15:00:00Z',
        },
        // 无效记录（缺role）——不计入
        {
          date: '2025-11-01',
          employeeUid: '1',
          displayName: 'Alice',
          hours: 1,
          roleId: 'rX',
          payRate: 1000,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          hasAnomaly: true,
          anomalies: [{ type: 'MISSING_ROLE' }],
          clockIn: '2025-11-01T18:00:00Z',
        },
      ],
      externalDailyReceipts: [],
    };

    const out = reconcilePayroll(input, {}, { adapter });

    const rec = out.employees.find((e) => e.employeeUid === '1')!;
    expect(rec.totals.hours).toBeCloseTo(8.0, 2);
    expect(rec.reconciliation[OVERALL_ROLE_KEY].hours.delta).toBeCloseTo(0, 6);

    expect(rec.reconciliation['1'].hours.delta).toBeCloseTo(6 - 5.25, 6);
    expect(rec.reconciliation['2'].hours.delta).toBeCloseTo(2 - 2.75, 6);

    expect(rec.totals.ccTips).toBe(3500);
    expect(rec.totals.cashTips).toBe(1200);
  });
});

// =======================================================
// 3) includeRoleNames 过滤测试
// =======================================================
describe('reconcilePayroll - includeRoleNames', () => {
  it('skips roles not in includeRoleNames when checking', () => {
    const adapter = makeAdapter({
      dayTotals: { '2025-11-01': { hours: 0, ccTips: 0, serviceCharge: 0, cashTips: 0 } },
      empRows: [
        {
          date: '2025-11-01',
          employeeUid: '1',
          displayName: 'Alice',
          segments: [
            {
              roleId: '4',
              roleName: 'Host',
              position: 'FRONT_OF_HOUSE',
              payRate: 1000,
              payType: 'HOURLY',
              hours: 2,
              ccTips: 0,
              cashTips: 0,
            },
            {
              roleId: '1',
              roleName: 'Server',
              position: 'FRONT_OF_HOUSE',
              payRate: 1500,
              payType: 'HOURLY',
              hours: 4,
              ccTips: 0,
              cashTips: 0,
            },
          ],
        },
      ],
    });

    const state = makeState();

    const input: ReconcileInput = {
      payrollState: state,
      externalDailyEvents: [
        {
          date: '2025-11-01',
          employeeUid: '1',
          displayName: 'Alice',
          hours: 1,
          roleId: 'r1',
          roleName: 'Host',
          payRate: 1000,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          clockIn: '2025-11-01T12:00:00Z',
        },
        {
          date: '2025-11-01',
          employeeUid: '1',
          displayName: 'Alice',
          hours: 5,
          roleId: 'r2',
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          clockIn: '2025-11-01T15:00:00Z',
        },
      ],
      externalDailyReceipts: [],
    };

    const out = reconcilePayroll(input, {}, { adapter, includeRoleIds: ['1'] });

    const rec = out.employees[0];
    expect(rec.reconciliation['1']).toBeDefined();
    expect(rec.reconciliation['4']).toBeUndefined();
    expect(rec.totals.hours).toBeCloseTo(6);
  });
});

// =======================================================
// 4) 排序 + meta
// =======================================================
describe('reconcilePayroll - meta & sort', () => {
  it('sorts by date & uid, meta contains timeClockEventsByEmployee', () => {
    const adapter = makeAdapter({
      dayTotals: {
        '2025-11-02': { hours: 0, ccTips: 0, serviceCharge: 0, cashTips: 0 },
        '2025-11-01': { hours: 0, ccTips: 0, serviceCharge: 0, cashTips: 0 },
      },
      empRows: [],
    });

    const state = makeState();

    const input: ReconcileInput = {
      payrollState: state,
      externalDailyEvents: [
        {
          date: '2025-11-02',
          employeeUid: 'u2',
          displayName: 'B',
          hours: 1,
          roleId: 'r1',
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          clockIn: '2025-11-02T12:00:00Z',
        },
        {
          date: '2025-11-01',
          employeeUid: 'u1',
          displayName: 'A C',
          hours: 1,
          roleId: 'r1',
          roleName: 'Server',
          payRate: 1500,
          payType: 'HOURLY',
          position: 'FRONT_OF_HOUSE',
          clockIn: '2025-11-01T12:00:00Z',
        },
      ],
      externalDailyReceipts: [],
    };

    const out = reconcilePayroll(input, {}, { adapter });
    expect(out.days.map((d) => d.date)).toEqual(['2025-11-01', '2025-11-02']);
    expect(out.employees.map((e) => `${e.date}::${e.employeeUid}`)).toEqual([
      '2025-11-01::u1',
      '2025-11-02::u2',
    ]);
    expect(out.meta?.timeClockEventsByEmpKey).toBeDefined();
    expect(Object.keys(out.meta.timeClockEventsByEmpKey!)).toContain('u1:::A C');
  });
});
