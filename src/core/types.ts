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

export interface SpreadInput {
  records: ShiftRecord[];
  minPayRate: number;
  /**
   * 是否仅在“已有 extraHours>0”时才生效。
   * 你的 PHP 逻辑是：从外部源算出 extra_hours>0 才发 spread，
   * 这里保留开关，默认 true（与现有一致）。
   */
  onlyIfExtraHoursPositive?: boolean;
  extraHoursFromSource?: number; // 外部算好的 extra_hours（如 HomeBase）
}

export interface SpreadResult {
  spreadHours: number; // 累计 1 小时/天
  spreadPay: number; // spreadHours * minPayRate
  perDate?: Array<{ date: string; hours: number; pay: number }>;
}

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
