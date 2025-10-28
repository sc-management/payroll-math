import { Day, Meal, PayrollState, PeriodId } from './payroll-types';
import { PayrollModel } from '../types/frontend';
import { applyMinimumPayAdjustment } from '../core/minimumPay';
import { num } from './number';

const periodToDayMeal: Record<PeriodId, { day: Day; meal: Meal }> = {
  '1': { day: 'Mon', meal: 'lunch' },
  '2': { day: 'Mon', meal: 'dinner' },
  '3': { day: 'Tue', meal: 'lunch' },
  '4': { day: 'Tue', meal: 'dinner' },
  '5': { day: 'Wed', meal: 'lunch' },
  '6': { day: 'Wed', meal: 'dinner' },
  '7': { day: 'Thu', meal: 'lunch' },
  '8': { day: 'Thu', meal: 'dinner' },
  '9': { day: 'Fri', meal: 'lunch' },
  '10': { day: 'Fri', meal: 'dinner' },
  '11': { day: 'Sat', meal: 'lunch' },
  '12': { day: 'Sat', meal: 'dinner' },
  '13': { day: 'Sun', meal: 'lunch' },
  '14': { day: 'Sun', meal: 'dinner' },
};

export function fromStateToModel(s: PayrollState): PayrollModel {
  // Period blocks (1..14)
  const blocks: PayrollModel['blocks'] = [];
  for (let i = 1; i <= 14; i++) {
    const pid = String(i) as PeriodId;
    const dm = periodToDayMeal[pid];
    const rec = s.periods?.[pid] || {
      id: pid,
      sales: 0,
      cashTips: 0,
      ccTips: 0,
      serviceCharge: 0,
      busserPercent: 0,
    };
    const periodBlock = {
      periodId: pid,
      day: dm.day,
      meal: dm.meal,
      sales: rec.sales,
      cashTips: rec.cashTips,
      ccTips: rec.ccTips,
      serviceCharge: rec.serviceCharge,
      tipsTotal: rec.ccTips + rec.serviceCharge,
      busserPercent: rec.busserPercent,
    };
    blocks.push(periodBlock);
  }

  const roleMap = new Map<string, PayrollModel['sections'][number]>();
  for (const emp of s.employees) {
    const bucket = roleMap.get(emp.roleName) ?? { roleName: emp.roleName, employees: [] };
    const totalHour = Object.values(emp.byPeriod).reduce((a, c) => a + (c.hour ?? 0), 0);
    const totalCc = Object.values(emp.byPeriod).reduce((a, c) => a + (c.cc ?? 0), 0);
    const totalCash = Object.values(emp.byPeriod).reduce((a, c) => a + (c.cash ?? 0), 0);

    const regularHours = Math.min(totalHour, 40);
    const overtimeHours = Math.max(totalHour - 40, 0);
    const payAmount = regularHours * emp.payRate + overtimeHours * emp.payRate * 1.5 + totalCc;
    const { tips: totalReportingCc, tipsCash: totalReportingCash } = applyMinimumPayAdjustment({
      regularHours,
      overtimeHours,
      payAmount,
      tips: totalCc,
      tipsCash: totalCash,
      bonus: 0,
      minPayRate: s.meta.minPayRate,
    });

    bucket.employees.push({
      uid: emp.uid,
      name: emp.name,
      payRate: emp.payRate,
      totalHour,
      totalCc: totalReportingCc,
      totalCash: totalReportingCash,
      byPeriod: Object.fromEntries(
        Object.entries(emp.byPeriod).map(([pid, cell]) => [
          pid,
          {
            hour: cell.hour,
            cc: cell.cc,
            percent: cell.percent,
            cash: cell.cash,
            total: cell.total,
          },
        ]),
      ),
    });
    roleMap.set(emp.roleName, bucket);
  }

  const allLogs = s.logs;
  const payrollLogs = allLogs.filter((l) => l.type === 1);
  const periodLogs = allLogs.filter((l) => l.type === 2 || l.type === 4);
  const employeeLogs = allLogs.filter((l) => l.type === 3 || l.type === 5);

  const grouped: PayrollModel['logs'] = {
    payroll: payrollLogs,
    period: {},
    employee: {},
    all: allLogs,
  };

  // 按 period_id 聚合 period logs
  for (const log of periodLogs) {
    const maybePid: string = log.raw?.period_id ? String(log.raw?.period_id) : log.raw?.periodId;
    const n = num(maybePid);
    if (Number.isInteger(n) && n >= 1 && n <= 14) {
      const pid = String(n) as PeriodId;
      grouped.period[pid] ??= [];
      grouped.period[pid]!.push(log);
    }
  }

  // 按 uid 聚合 employee logs
  for (const log of employeeLogs) {
    const uid = String(log.raw?.uid);
    if (uid) {
      grouped.employee[uid] ||= [];
      grouped.employee[uid].push(log);
    }
  }

  return {
    blocks,
    sections: [...roleMap.values()],
    meta: {
      id: s.meta.payrollId,
      locationId: s.meta.locationId,
      locationName: s.meta.locationName,
      minPayRate: s.meta.minPayRate,
      startDate: s.meta.startDateISO || '',
      endDate: s.meta.endDateISO || '',
      totalCashTips: s.meta.totalCashTips || 0,
      totalTips: s.meta.totalTips || 0,
    },
    logs: grouped,
  };
}
