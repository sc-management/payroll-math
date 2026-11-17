import { describe, expect, it } from 'vitest';
import {
  makeCurrentSheetAdapterDate,
  reconcilePayroll,
  summarizeWeekly,
  type ExternalTimeClockEvent,
  type PayrollState,
} from '../src';
import { makeCell, makeEmployee, makePeriod, makeState } from './helpers/factories';

const date = '2025-09-22';
const range = { startDate: date, endDate: '2025-09-28' };

function payrollOnlyState() {
  return makeState({
    periods: { '1': makePeriod() },
    employees: [makeEmployee({ roleId: '1', byPeriod: { '1': makeCell({ hour: 7 }) } })],
  });
}

function event(overrides: Partial<ExternalTimeClockEvent> = {}): ExternalTimeClockEvent {
  return {
    date,
    employeeUid: '100',
    displayName: 'Alice',
    roleId: '2',
    roleName: 'Busser',
    position: 'FRONT_OF_HOUSE',
    payType: 'HOURLY',
    payRate: 2000,
    hours: 7,
    clockIn: `${date}T14:00:00Z`,
    ...overrides,
  };
}

function reconcile(state: PayrollState, events: ExternalTimeClockEvent[] = []) {
  return reconcilePayroll(
    { payrollState: state, externalDailyEvents: events, externalDailyReceipts: [] },
    {},
    { adapter: makeCurrentSheetAdapterDate() },
  );
}

describe('daily mismatch role names through reconciliation and weekly summary', () => {
  it.each(['HOURLY', 'SALARY'] as const)(
    'keeps a payroll-only %s role visible without creating payable hours',
    (payType) => {
      const state = payrollOnlyState();
      state.employees[0].payType = payType;
      const reconciled = reconcile(state);
      const summary = summarizeWeekly(reconciled, range);

      expect(summary.employees).toHaveLength(1);
      const employee = summary.employees[0];
      expect(employee.dailyMismatches).toEqual([
        expect.objectContaining({
          date,
          roleId: '1',
          roleName: 'Server',
          variance: expect.objectContaining({ sheet: 7, external: 0, delta: 7, status: 'ERROR' }),
        }),
      ]);
      expect(reconciled.employees[0].reconciliation['1']).toMatchObject({ roleName: 'Server' });
      expect(reconciled.employees[0].segments).toEqual([]);
      expect(reconciled.employees[0].totals.hours).toBe(0);
      expect(employee.hoursByRole).toEqual({});
      expect(employee.totals).toEqual({
        regularHours: 0,
        overtimeHours: 0,
        spreadOfHours: 0,
        wages: 0,
        ccTips: 0,
        cashTips: 0,
        gross: 0,
        boh: { hours: 0, wages: 0 },
        foh: { hours: 0, wages: 0 },
      });
      expect(summary.report?.blocking).toBe(true);
      expect(summary.report?.issues).toContainEqual(
        expect.objectContaining({
          code: 'HOURS_MISMATCH_BY_ROLE',
          level: 'ERROR',
          message: expect.stringContaining('(Server): Sheet = 7h, External = 0h'),
        }),
      );
    },
  );

  it('uses the payroll role when Homebase has no valid pay-rate record', () => {
    const reconciled = reconcile(payrollOnlyState(), [
      event({ roleId: '1', roleName: 'Unmapped external role', payRate: undefined }),
    ]);
    const employee = summarizeWeekly(reconciled, range).employees[0];

    expect(employee.dailyMismatches?.[0]).toMatchObject({
      roleName: 'Server',
      variance: { sheet: 7, external: 0, status: 'ERROR' },
    });
    expect(reconciled.employees[0].segments).toEqual([]);
    expect(employee.hoursByRole).toEqual({});
    expect(employee.totals).toMatchObject({ regularHours: 0, overtimeHours: 0, wages: 0 });
  });

  it('names both different roles even when total hours match, paying only the Homebase role', () => {
    const reconciled = reconcile(payrollOnlyState(), [event()]);
    const summary = summarizeWeekly(reconciled, range);
    const employee = summary.employees[0];

    expect(employee.dailyMismatches).toEqual([
      expect.objectContaining({
        roleId: '1',
        roleName: 'Server',
        variance: expect.objectContaining({ sheet: 7, external: 0, status: 'ERROR' }),
      }),
      expect.objectContaining({
        roleId: '2',
        roleName: 'Busser',
        variance: expect.objectContaining({ sheet: 0, external: 7, status: 'ERROR' }),
      }),
    ]);
    expect(reconciled.employees[0].segments?.map((s) => s.roleId)).toEqual(['2']);
    expect(Object.keys(employee.hoursByRole)).toEqual(['2']);
    expect(employee.totals).toMatchObject({ regularHours: 7, overtimeHours: 0, wages: 14000 });
    expect(summary.report?.issueCountByLevel?.ERROR).toBe(2);
    expect(summary.report?.blocking).toBe(true);
  });

  it('preserves overtime and minimum-pay tip adjustments when payroll has another role', () => {
    const state = payrollOnlyState();
    const events: ExternalTimeClockEvent[] = [];
    for (let day = 0; day < 5; day++) {
      const periodId = String(day * 2 + 1);
      const workDate = `2025-09-${22 + day}`;
      state.periods[periodId] = makePeriod({ id: periodId, ccTips: 2000, cashTips: 500 });
      state.employees[0].byPeriod[periodId] = makeCell({ hour: 7, cc: 2000, cash: 500 });
      events.push(
        event({ date: workDate, clockIn: `${workDate}T14:00:00Z`, hours: 9, payRate: 1000 }),
      );
    }
    const reconciled = reconcile(state, events);
    const employee = summarizeWeekly(reconciled, range).employees[0];

    expect(employee.dailyMismatches).toHaveLength(10);
    expect(employee.dailyMismatches?.map((m) => m.roleName)).not.toContain('Unknown');
    expect(Object.keys(employee.hoursByRole)).toEqual(['2']);
    expect(employee.hoursByRole['2']).toMatchObject({
      regularHours: 40,
      overtimeHours: 5,
      wages: 47500,
    });
    expect(employee.totals).toMatchObject({
      regularHours: 40,
      overtimeHours: 5,
      spreadOfHours: 0,
      wages: 47500,
      ccTips: 21250,
      cashTips: 2500,
      gross: 71250,
      foh: { hours: 45, wages: 47500 },
    });
  });

  it('keeps the existing segment-name fallback for older reconciled data', () => {
    const reconciled = reconcile(payrollOnlyState(), [event()]);
    for (const entry of Object.values(reconciled.employees[0].reconciliation)) {
      delete entry.roleName;
    }
    const employee = summarizeWeekly(reconciled, range).employees[0];
    expect(employee.dailyMismatches?.find((m) => m.roleId === '2')?.roleName).toBe('Busser');
  });
});
