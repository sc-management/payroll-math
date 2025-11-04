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
  payAmount: number; // 当前总工资（小时工资 + 其它已计入工资的金额；不含 tipsCash 调整后的值）
  tips: number;
  tipsCash: number;
  bonus: number;
  minPayRate: number;
}

export interface MinPayAdjustResult {
  tips: number;
  tipsCash: number;
  payAmount: number;
  minimumPay: number;
}
