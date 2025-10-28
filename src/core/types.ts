import { PayType, Position } from '../state/payroll-types';

export type RoleId = 1 | 2 | 3 | 4 | number; // 1: Server, 2: Busser, 3: Bartender, 4: Host

export interface PeriodInfo {
  periodId: number;
  sales: number;
  ccTips: number;
  sc: number;
  cashTips: number;
  totalTips: number; // ccTips + sc
  busPercent: number; // 0.1 => 10%
}

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
  roleId: RoleId;
  payRate: number;
  payType: 1 | 2; // 1 hourly, 2 salary
  hour: number;
  minPayRate: number;

  currentCc: number;
  currentCash: number;
  percent: number; // 0.25 表示 25%

  period: PeriodInfo;

  otherRoleTotalCcTips: number;
  otherRoleTotalCashTips: number;
  bartenderTotalCcTips: number;
  bartenderTotalCashTips: number;
  hostTotalCcTips: number;
  hostTotalCashTips: number;

  othersPercentage: number; // 其他同角色的百分比总和（单位：百分数，如 25）
  otherPeriodTotalHours: number;
  otherPeriodTotalCc: number;
  otherPeriodTotalCash: number;
}

export interface EmployeeCalcResult {
  tipsCc: number;
  tipsCash: number;
  total: number; // 本段显示总额（含 min pay 兜底）四舍五入到整数
  totalHour: number; // 累计小时（含其它段）
  cashReport: number; // 报现金（整数）
  totalTips: number; // 累计小费（含 sc_makeup）
  rolePercentage: number; // othersPercentage + 自己( percent*100 )
  tipsUpdated: boolean; // 仅给前端联动用，纯计算置 false
}

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
