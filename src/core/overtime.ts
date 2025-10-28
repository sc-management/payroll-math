import { ShiftRecord, WeeklyHoursPay } from './types';

export function computeWeeklyOvertime(records: ShiftRecord[]): WeeklyHoursPay {
  // 先按日期排序，保证 overtime 切分顺序一致
  const recs = [...records].sort((a, b) => a.date.localeCompare(b.date));

  let regularHours = 0;
  let overtimeHours = 0;
  let fohOvertimeHours = 0;
  let bohOvertimeHours = 0;
  let fohHours = 0;
  let bohHours = 0;
  let hourPay = 0;

  for (const r of recs) {
    if (r.payType === 2) {
      // salary：小时全部记 regular，本记录的小时工资视为“周薪一次性计入”
      regularHours += r.hour;
      hourPay += r.payRate;
      if (r.position === 1) fohHours += r.hour;
      else if (r.position === 2) bohHours += r.hour;
      continue;
    }

    // 时薪：先塞到 regular，超过 40 的部分算 overtime
    const remainingRegularCap = Math.max(0, 40 - regularHours);
    const toRegular = Math.min(remainingRegularCap, r.hour);
    const toOvertime = r.hour - toRegular;

    regularHours += toRegular;
    overtimeHours += toOvertime;

    // 工资：regular * rate + overtime * 1.5 * rate
    hourPay += toRegular * r.payRate + toOvertime * 1.5 * r.payRate;

    // FOH/BOH 累计
    if (r.position === 1) {
      fohHours += r.hour;
      fohOvertimeHours += toOvertime;
    } else if (r.position === 2) {
      bohHours += r.hour;
      bohOvertimeHours += toOvertime;
    }
  }

  // 保留两位
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    fohOvertimeHours: round2(fohOvertimeHours),
    bohOvertimeHours: round2(bohOvertimeHours),
    fohHours: round2(fohHours),
    bohHours: round2(bohHours),
    hourPay: round2(hourPay),
  };
}
