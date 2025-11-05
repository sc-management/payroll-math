import { EmployeeDayReconciliation, PayrollReconciledSummary, Variance } from '../reconcile/types';
import { OVERALL_ROLE_KEY, WeeklyEmployeeSummary, WeeklySummary } from './type';
import { MoneyCents } from '../state/number';
import { addVariance } from './helpers';
import { ShiftRecord } from '../core/types';
import { computeWeeklyOvertimeByRole } from '../core/overtime';
import { applyMinimumPayAdjustment } from '../core/minimumPay';
import { round2 } from '../core/math';

type BuildOpts = {
  weekOvertimeThreshold?: number; // 每周多少小时开始算 OT
  defaultOvertimeMultiplier?: number; // 默认 OT 倍率
  spreadRequired?: boolean; // 是否强制计算 spread of hours
};

export function summarizeWeekly(
  reconciled: PayrollReconciledSummary,
  range: { startDate: string; endDate: string },
  opts?: BuildOpts,
): WeeklySummary {
  const threshold = opts?.weekOvertimeThreshold ?? 40;
  const defaultOTM = opts?.defaultOvertimeMultiplier ?? 1.5;
  const spreadRequired = opts?.spreadRequired ?? reconciled.meta.locationState === 'NY';

  const inRange = (d: string) => d >= range.startDate && d <= range.endDate;

  // 1) days + totals（周级）
  const days = reconciled.days.filter((d) => inRange(d.date));

  const weeklyTotals = days.reduce(
    (acc, day) => {
      acc.ccTips += day.totals.ccTips;
      acc.cashTips += day.totals.cashTips;
      acc.serviceCharge += day.totals.serviceCharge;
      return acc;
    },
    { hours: 0, ccTips: 0, cashTips: 0, serviceCharge: 0 },
  );

  // 2) 员工周级聚合
  const mapByEmp = new Map<string, WeeklyEmployeeSummary>();

  // 先把“时长线”（用于拆 regular/OT）从 segments 抽出来：按日序遍历
  const employeeDayList = reconciled.employees.filter((e) => inRange(e.date));
  const empKey = (e: EmployeeDayReconciliation) => e.employeeUid;

  // 2.1 预建空壳
  for (const e of employeeDayList) {
    const k = empKey(e);
    if (!mapByEmp.has(k)) {
      mapByEmp.set(k, {
        employeeUid: e.employeeUid,
        displayName: e.displayName,
        hoursByRole: {},
        totals: {
          regularHours: 0,
          overtimeHours: 0,
          spreadOfHours: 0,
          wages: 0 as MoneyCents,
          ccTips: 0 as MoneyCents,
          cashTips: 0 as MoneyCents,
          gross: 0 as MoneyCents,
          boh: { hours: 0, wages: 0 as MoneyCents },
          foh: { hours: 0, wages: 0 as MoneyCents },
        },
        reconciliation: {
          [OVERALL_ROLE_KEY]: {
            sheet: 0,
            external: 0,
            delta: 0,
            pct: 0,
            status: 'OK',
            source: 'EXTERNAL',
          },
          roles: {},
        },
      });
    }
  }

  // 2.2 tips, spreadOfHours 预聚合
  for (const e of employeeDayList) {
    const emp = mapByEmp.get(empKey(e))!;
    // 展示用 tips 合计
    emp.totals.ccTips += e.totals.ccTips;
    emp.totals.cashTips += e.totals.cashTips;
    // 统计 spread of hours
    if (e.totals.hours >= 10) emp.totals.spreadOfHours += 1;

    // 预建 role slots（用于后续小时数更新）
    for (const s of e.segments || []) {
      if (!emp.hoursByRole[s.roleId]) {
        emp.hoursByRole[s.roleId] = {
          roleId: s.roleId,
          roleName: s.roleName,
          payRate: s.payRate,
          payType: s.payType,
          position: s.position,
          regularHours: 0,
          overtimeHours: 0,
          overtimeMultiplier: defaultOTM,
          wages: 0 as MoneyCents,
        };
      } else if (emp.hoursByRole[s.roleId] && s.payType === 'SALARY') {
        // 已存在且为 salary，则直接更新hour
        emp.hoursByRole[s.roleId].regularHours += s.hours;
      }
    }
  }

  // 2.3 variance 聚合（只看 reconciliation）
  for (const e of employeeDayList) {
    const emp = mapByEmp.get(empKey(e))!;
    for (const [roleId, rec] of Object.entries(e.reconciliation ?? {})) {
      if (roleId === OVERALL_ROLE_KEY || roleId.toLowerCase() === 'overall') continue;
      const v = rec.hours;
      const prev = emp.reconciliation.roles[roleId];
      emp.reconciliation.roles[roleId] = addVariance(prev, v);
      // 填入mismatches
      if (v.status !== 'OK') {
        emp.dailyMismatches ??= [];
        emp.dailyMismatches.push({
          date: e.date,
          roleId,
          roleName: emp.hoursByRole[roleId]?.roleName || 'Unknown',
          type: 'HOURS',
          field: 'hours',
          variance: v,
        });
      }
    }
  }
  for (const emp of mapByEmp.values()) {
    let overall: Variance<number> | undefined = undefined;
    for (const v of Object.values(emp.reconciliation.roles)) {
      overall = addVariance(overall, v);
    }
    emp.reconciliation[OVERALL_ROLE_KEY] = overall ?? emp.reconciliation[OVERALL_ROLE_KEY];
  }

  // 2.4 逐员工进行“regular/OT 拆分 + 工资计算”
  if (!reconciled.meta.timeClockEventsByEmpKey) {
    throw new Error('Missing timeClockEventsByEmp in reconciled meta');
  }

  for (const [k, emp] of mapByEmp) {
    const slices = reconciled.meta.timeClockEventsByEmpKey[k];
    if (!slices || slices.length === 0) continue; // 无打卡记录，跳过
    const hourLines: ShiftRecord[] = slices
      .filter((s) => s.payType === 'HOURLY')
      .sort((a, b) => a.clockIn.localeCompare(b.clockIn))
      .map((s) => ({
        clockIn: s.clockIn,
        hour: s.hours,
        roleId: s.roleId!,
      })); // 按时间排序，筛选掉salary

    const workingHoursByRole = computeWeeklyOvertimeByRole(hourLines, threshold);
    for (const role of Object.keys(emp.hoursByRole)) {
      const roleSummary = emp.hoursByRole[role];
      if (roleSummary.payType === 'SALARY') {
        roleSummary.wages = roleSummary.payRate;
        continue;
      }
      const roleHours = workingHoursByRole[role];
      if (!roleHours) continue;
      const { regularHours, overtimeHours } = roleHours;
      const wages =
        regularHours * roleSummary.payRate +
        overtimeHours * roleSummary.payRate * roleSummary.overtimeMultiplier;
      roleSummary.regularHours = regularHours;
      roleSummary.overtimeHours = overtimeHours;
      roleSummary.wages = wages;
    }

    // 2.5 计算员工总计
    for (const roleSummary of Object.values(emp.hoursByRole)) {
      emp.totals.regularHours += roleSummary.regularHours;
      emp.totals.overtimeHours += roleSummary.overtimeHours;
      emp.totals.wages += roleSummary.wages;
    }

    const { tips: adjustedCcTips, tipsCash: adjustedCashTips } = applyMinimumPayAdjustment({
      regularHours: emp.totals.regularHours,
      overtimeHours: emp.totals.overtimeHours,
      payAmount: emp.totals.wages,
      tips: emp.totals.ccTips,
      tipsCash: emp.totals.cashTips,
      bonus: 0,
      minimumWage: reconciled.meta.minimumWage,
    });
    emp.totals.ccTips = adjustedCcTips;
    emp.totals.cashTips = adjustedCashTips;

    if (spreadRequired && emp.totals.spreadOfHours > 0) {
      emp.hoursByRole['SPREAD_OF_HOURS'] = {
        roleId: 'SPREAD_OF_HOURS',
        roleName: 'Spread of Hours',
        payRate: reconciled.meta.minimumWage,
        payType: 'HOURLY',
        position: 'SPREAD_OF_HOURS',
        regularHours: emp.totals.spreadOfHours,
        overtimeHours: 0,
        overtimeMultiplier: defaultOTM,
        wages: emp.totals.spreadOfHours * reconciled.meta.minimumWage,
      };
    }

    // 计算前后端分类工资和总收入前，先取整
    emp.totals.wages = Math.round(emp.totals.wages) as MoneyCents;
    emp.totals.ccTips = Math.round(emp.totals.ccTips) as MoneyCents;
    emp.totals.cashTips = Math.round(emp.totals.cashTips) as MoneyCents;

    // 2.6 计算总收入
    emp.totals.gross =
      emp.totals.wages +
      emp.totals.ccTips +
      emp.totals.cashTips +
      (spreadRequired ? emp.totals.spreadOfHours * reconciled.meta.minimumWage : 0);

    // 2.7 BOH / FOH 分类汇总
    for (const roleSummary of Object.values(emp.hoursByRole)) {
      if (roleSummary.position === 'BACK_OF_HOUSE') {
        emp.totals.boh.hours += roleSummary.regularHours + roleSummary.overtimeHours;
        emp.totals.boh.wages += roleSummary.wages;
      } else if (roleSummary.position === 'FRONT_OF_HOUSE') {
        emp.totals.foh.hours += roleSummary.regularHours + roleSummary.overtimeHours;
        emp.totals.foh.wages += roleSummary.wages;
      }
    }

    // 2.8 取整工资相关字段
    emp.totals.gross = Math.round(emp.totals.gross) as MoneyCents;
    emp.totals.boh.wages = Math.round(emp.totals.boh.wages) as MoneyCents;
    emp.totals.foh.wages = Math.round(emp.totals.foh.wages) as MoneyCents;

    // 2.9 小时取后两位
    for (const roleSummary of Object.values(emp.hoursByRole)) {
      roleSummary.regularHours = round2(roleSummary.regularHours);
      roleSummary.overtimeHours = round2(roleSummary.overtimeHours);
    }
    emp.totals.regularHours = round2(emp.totals.regularHours);
    emp.totals.overtimeHours = round2(emp.totals.overtimeHours);
    emp.totals.spreadOfHours = round2(emp.totals.spreadOfHours);
    emp.totals.boh.hours = round2(emp.totals.boh.hours);
    emp.totals.foh.hours = round2(emp.totals.foh.hours);
  }

  // 2.10) 整理最终员工列表：过滤无数据的 & 排序
  const employees = Array.from(mapByEmp.values())
    .filter((e) => e.totals.gross > 0 || (e.dailyMismatches?.length ?? 0) > 0)
    .sort((a, b) => a.employeeUid.localeCompare(b.employeeUid));

  // 3) 放入Report
  const issueCountByLevel = { INFO: 0, WARNING: 0, ERROR: 0 };

  for (const issue of reconciled.report?.issues ?? []) {
    issueCountByLevel[issue.level]++;
  }

  const blocking = issueCountByLevel.ERROR > 0;

  const report: WeeklySummary['report'] = {
    score: reconciled.report?.score ?? 100,
    issues: reconciled.report?.issues ?? [],
    issueCountByLevel,
    blocking,
  };

  // 4) 返回结果
  return {
    range,
    employees,
    days,
    totals: weeklyTotals,
    meta: reconciled.meta,
    report,
  };
}
