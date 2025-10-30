// tests/helpers/factories.ts
import type { PayrollState, StateEmployee, StateEmployeeCell, StatePeriod } from '../../src';

export const P1 = '1';
export const P2 = '2';

export function makePeriod(partial?: Partial<StatePeriod>): StatePeriod {
  return {
    id: partial?.id ?? P1,
    sales: partial?.sales ?? 0,
    ccTips: partial?.ccTips ?? 0,
    cashTips: partial?.cashTips ?? 0,
    serviceCharge: partial?.serviceCharge ?? 0,
    busserPercent: partial?.busserPercent ?? 0,
  };
}

export function makeCell(partial?: Partial<StateEmployeeCell>): StateEmployeeCell {
  return {
    hour: partial?.hour ?? 0,
    cc: partial?.cc ?? 0,
    cash: partial?.cash ?? 0,
    percent: partial?.percent ?? 0,
  };
}

export function makeEmployee(partial?: Partial<StateEmployee>): StateEmployee {
  return {
    uid: partial?.uid ?? '100',
    roleId: partial?.roleId ?? 'r1',
    roleName: partial?.roleName ?? 'Server',
    name: partial?.name ?? 'Alice',
    payRate: partial?.payRate ?? 1500,
    payType: partial?.payType ?? 1,
    byPeriod: partial?.byPeriod ?? {},
  };
}

export function makeState(partial?: Partial<PayrollState>): PayrollState {
  return {
    meta: {
      payrollId: partial?.meta?.payrollId ?? 'pid',
      locationId: partial?.meta?.locationId ?? '1',
      locationName: partial?.meta?.locationName ?? 'Newton',
      minPayRate: partial?.meta?.minPayRate ?? 1500,
      startDateISO: partial?.meta?.startDateISO ?? '2025-09-22T00:00:00Z',
      endDateISO: partial?.meta?.endDateISO ?? '2025-09-28T23:59:59Z',
      totalCashTips: partial?.meta?.totalCashTips,
      totalTips: partial?.meta?.totalTips,
    },
    periods: partial?.periods ?? {},
    employees: partial?.employees ?? [],
    logs: partial?.logs ?? [],
  };
}
