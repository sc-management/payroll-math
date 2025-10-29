import {
  PayrollChange,
  PayrollState,
  StateEmployeeCell,
  StatePeriod,
} from '../state/payroll-types';
import { clamp01 } from '../state/number';

export function applyDirectEdits(state: PayrollState, changes: PayrollChange[]) {
  for (const c of changes) {
    if (c.kind === 'period') {
      const p = ensurePeriod(state, c.periodId);
      switch (c.field) {
        case 'sales':
          p.sales = c.value as number;
          break;
        case 'ccTips':
          p.ccTips = c.value as number;
          break;
        case 'cashTips':
          p.cashTips = c.value as number;
          break;
        case 'serviceCharge':
          p.serviceCharge = c.value as number;
          break;
        case 'busserPercent':
          p.busserPercent = clamp01(c.value as number);
          break;
      }
    } else if (c.kind === 'employee') {
      const emp = state.employees.find((e) => e.uid === c.uid && e.roleName === c.roleName);
      if (!emp) continue;
      const cell = ensureEmployeeCell(emp, c.periodId);
      switch (c.field) {
        case 'hour':
          cell.hour = c.value as number;
          break;
        case 'cc':
          cell.cc = c.value as number;
          break;
        case 'cash':
          cell.cash = c.value as number;
          break;
        case 'percent':
          cell.percent = clamp01(c.value as number);
          break;
      }
    }
  }
}

function ensurePeriod(state: PayrollState, pid: string): StatePeriod {
  return (state.periods[pid] ??= {
    id: pid,
    sales: 0,
    ccTips: 0,
    cashTips: 0,
    serviceCharge: 0,
    busserPercent: 0,
  });
}

function ensureEmployeeCell(
  emp: { byPeriod: Record<string, StateEmployeeCell> },
  pid: string,
): StateEmployeeCell {
  return (emp.byPeriod[pid] ??= {
    hour: 0,
    cc: 0,
    cash: 0,
    percent: 0,
  });
}
