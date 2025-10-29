import { PayrollDiff, PayrollState } from '../state/payroll-types';

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

  return { periods, employees, meta };
}
