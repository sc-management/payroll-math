import { EmployeeDayReconciliation, ReconciledDay } from './types';
import { PayrollState } from '../state/payroll-types';

export type SheetEmployeeDayRow = Omit<EmployeeDayReconciliation, 'totals' | 'reconciliation'>;
export type SheetDayTotals = ReconciledDay['totals'];

export interface SheetAdapter {
  listDates(state: PayrollState): string[];
  getDayTotals(state: PayrollState, date: string): SheetDayTotals;
  listEmployeeDayRows(state: PayrollState): SheetEmployeeDayRow[];
}

export const defaultSheetAdapter: SheetAdapter = {
  listDates() {
    throw new Error('[reconcile] defaultSheetAdapter.listDates not implemented');
  },
  getDayTotals() {
    throw new Error('[reconcile] defaultSheetAdapter.getDayTotals not implemented');
  },
  listEmployeeDayRows() {
    throw new Error('[reconcile] defaultSheetAdapter.listEmployeeDayRows not implemented');
  },
};
