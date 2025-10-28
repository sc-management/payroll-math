import { PeriodId, StateLogEntry } from '../state/payroll-types';

export interface PayrollModel {
  blocks: PeriodBlock[];
  sections: { roleName: string; employees: EmployeeRow[] }[];
  busserByPeriod: Record<string, number>;
  meta: PayrollMeta;
  logs: PayrollLogGrouped;
}

export interface PeriodBlock {
  periodId: string;
  day: string;
  meal: 'lunch' | 'dinner';
  sales: number;
  cashTips: number;
  ccTips: number;
  serviceCharge: number;
  tipsTotal: number;
}

export interface EmployeeRow {
  uid: string;
  name: string;
  payRate: number;
  totalHour: number;
  totalCc: number;
  totalCash: number;
  byPeriod: Record<string, EmployeeCell>;
}

export interface EmployeeCell {
  hour?: number;
  cc?: number;
  percent?: number;
  cash?: number;
  total?: number;
}

export interface PayrollMeta {
  id: string;
  locationId: string;
  locationName: string;
  minPayRate: number;
  startDate: string;
  endDate: string;
  totalCashTips: number;
  totalTips: number;
}

export interface PayrollLogGrouped {
  /** 最近一次全局修改 */
  payroll: StateLogEntry[];
  /** 各 period 的修改 */
  period: Partial<Record<PeriodId, StateLogEntry[]>>;
  /** 各员工修改记录（按 uid 聚合） */
  employee: Record<string, StateLogEntry[]>;
  /** 所有日志的原始顺序 */
  all: StateLogEntry[];
}
