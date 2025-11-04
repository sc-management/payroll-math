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
  // Period blocks（只输出 s.periods 里实际存在的 period）
  const blocks: PayrollModel['blocks'] = Object.entries(s.periods ?? {})
    // 过滤：必须有记录，且在已知的 1..14 映射里
    .filter(([pid, rec]) => !!rec && periodToDayMeal[pid as PeriodId])
    // 按数字 periodId 排序，保证顺序稳定
    .sort(([a], [b]) => Number(a) - Number(b))
    // 映射为前端需要的 block 结构
    .map(([pid, rec]) => {
      const dm = periodToDayMeal[pid as PeriodId];
      const sales = rec.sales ?? 0;
      const ccTips = rec.ccTips ?? 0;
      const serviceCharge = rec.serviceCharge ?? 0;

      return {
        periodId: pid as PeriodId,
        day: dm.day,
        meal: dm.meal,
        sales,
        cashTips: rec.cashTips ?? 0,
        ccTips,
        serviceCharge,
        tipsTotal: ccTips + serviceCharge,
        tipsPercent: sales > 0 ? ((ccTips + serviceCharge) / sales) * 100 : undefined,
        busserPercent: rec.busserPercent ?? 0,
        startDate: new Date(s.meta.startDateISO),
        dayOffset: Math.floor((Number(pid) - 1) / 2),
      };
    });

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
      minimumWage: s.meta.minPayRate,
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
            hour: cell.hour || 0,
            cc: cell.cc || 0,
            percent: cell.percent || 0,
            cash: cell.cash || 0,
            total:
              (cell.cc || 0) +
              (cell.cash || 0) +
              ((emp.payType === 'SALARY' ? 0 : (cell.hour || 0) * emp.payRate) || 0),
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
