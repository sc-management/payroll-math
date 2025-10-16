export type Position = 1 | 2 | -1; // 1 FOH, 2 BOH, -1 Spread等虚拟
export type PayType = 1 | 2; // 1 hourly, 2 salary

export interface ShiftRecord {
  date: string; // "YYYY-MM-DD"
  hour: number; // 实际工时
  payRate: number; // 该记录对应时薪或周薪
  payType: PayType; // 1时薪 2周薪
  position: Position; // 1=FOH, 2=BOH
}

export interface WeeklyHoursPay {
  regularHours: number;
  overtimeHours: number;
  fohOvertimeHours: number;
  bohOvertimeHours: number;
  fohHours: number;
  bohHours: number;
  hourPay: number; // 仅小时工资（不含小费/奖金）
}

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
