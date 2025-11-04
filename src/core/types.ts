export interface PeriodCalcInput {
  sales: number;
  ccTips: number;
  sc: number;
  cashTips: number;
  state?: string;
}
export interface PeriodCalcResult {
  totalTips: number; // ccTips + sc
  tipsPercent: number; // totalTips / sales (4 位小数)
}

export interface EmployeeCalcInput {
  roleName: string;
  cc: number;
  cash: number;
  percent: number; // 0..1
  ccPoolAfterOthers: number; // 直接传入已扣除其他角色后的值
  cashPoolAfterOthers: number; // 直接传入已扣除其他角色后的值
  busserPercent: number; // 0..1
}

export interface EmployeeCalcResult {
  tipsCc: number;
  tipsCash: number;
}

export interface ShiftRecord {
  clockIn: string; // ISO 8601
  roleName: string;
  hour: number; // 实际工时
}

export type RoleWeeklyHours = {
  regularHours: number;
  overtimeHours: number;
};

export interface MinPayAdjustInput {
  regularHours: number;
  overtimeHours: number;
  payAmount: number; // cents
  tips: number; // cents
  tipsCash: number; // cents
  bonus: number; // cents
  minimumWage: number; // cents per hour
}

export interface MinPayAdjustResult {
  tips: number;
  tipsCash: number;
}
