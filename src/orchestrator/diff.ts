import { EmployeeField, PayrollDiff, PayrollState, PeriodField } from '../state/payroll-types';

export function buildDiff(
  before: PayrollState,
  after: PayrollState,
  affected: {
    periods: Set<string>;
    employees: Set<string>;
    roles: Set<string>;
  },
): PayrollDiff {
  if (!affected || before === after) {
    return { periods: [], employees: [], meta: {} };
  }
  const periods: PayrollDiff['periods'] = [];
  const employees: PayrollDiff['employees'] = [];
  const meta: PayrollDiff['meta'] = {};

  const periodFields: PeriodField[] = [
    'sales',
    'ccTips',
    'cashTips',
    'serviceCharge',
    'busserPercent',
  ];
  const employeeFields: EmployeeField[] = ['hour', 'cc', 'cash', 'percent'];

  // === Meta ===
  if (before.meta.totalCashTips !== after.meta.totalCashTips) {
    meta.totalCashTips = {
      before: before.meta.totalCashTips,
      after: after.meta.totalCashTips,
    };
  }
  if (before.meta.totalTips !== after.meta.totalTips) {
    meta.totalTips = {
      before: before.meta.totalTips,
      after: after.meta.totalTips,
    };
  }

  // === Period diffs ===
  for (const pid of affected.periods) {
    const b = before.periods?.[pid];
    const a = after.periods?.[pid];
    if (!b && !a) continue;

    for (const field of periodFields) {
      const bv = b?.[field];
      const av = a?.[field];
      if (bv !== av) {
        periods.push({
          periodId: pid,
          field: field, // cast to PeriodField
          before: bv,
          after: av,
        });
      }
    }
  }

  // === Employee diffs ===
  for (const key of affected.employees) {
    // key format: `${periodId}:${uid}:${roleName}`
    const [periodId, uid, ...rest] = key.split(':');
    const roleName = rest.join(':');

    const bEmp = before.employees.find((e) => e.uid === uid && e.roleName === roleName);
    const aEmp = after.employees.find((e) => e.uid === uid && e.roleName === roleName);

    const bCell = bEmp?.byPeriod?.[periodId];
    const aCell = aEmp?.byPeriod?.[periodId];

    if (!bCell && !aCell) continue;

    for (const field of employeeFields) {
      const bv = bCell?.[field];
      const av = aCell?.[field];
      if (bv !== av) {
        employees.push({
          periodId,
          uid,
          roleName,
          field: field, // cast to EmployeeField
          before: bv,
          after: av,
        });
      }
    }
  }

  return { periods, employees, meta };
}
