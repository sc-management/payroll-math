import { ReconcileInput } from './input-types';
import { ReconciliationConfig, defaultRules } from './rules';
import {
  EmployeeDayReconciliation,
  PayrollReconciledSummary,
  ReconciledDay,
  ReconciliationIssue,
  SheetRoleSlice,
  Variance,
} from './types';
import { defaultSheetAdapter, SheetAdapter, SheetEmployeeDayRow } from './sheet-adapter';
import { computeScore, groupBy, sumBy, varianceOfCents, varianceOfNumber } from './helpers';
import { clamp2 } from '../state/number';
import { OVERALL_ROLE_KEY } from '../summarize/type';

function formatCents(value: number) {
  return `$${(value / 100).toFixed(2)}`;
}

type Opts = {
  adapter?: SheetAdapter;
  includeRoleIds?: string[];
};

export function reconcilePayroll(
  input: ReconcileInput,
  config: Partial<ReconciliationConfig> = {},
  opts: Opts = {},
): PayrollReconciledSummary {
  const rules = { ...defaultRules, ...config };
  const adapter = opts.adapter ?? defaultSheetAdapter;
  const includeRoleIds = opts.includeRoleIds ?? ['1', '2', '3', '4']; // 默认 FOH 角色 ID 列表

  const { payrollState, externalDailyEvents, externalDailyReceipts, timezone, currency } = input;

  // ---------- 1) 读取 sheet ----------
  const sheetDateList = adapter.listDates(payrollState);
  const sheetDayTotals = new Map<string, ReconciledDay['totals']>();
  for (const d of sheetDateList) {
    const t = adapter.getDayTotals(payrollState, d);
    sheetDayTotals.set(d, {
      ccTips: t.ccTips,
      serviceCharge: t.serviceCharge,
      cashTips: t.cashTips,
    });
  }
  const sheetEmpDayRows = adapter.listEmployeeDayRows(payrollState);

  // ---------- 2) 外部聚合 ----------
  const hoursByDate = groupBy(externalDailyEvents, (x) => x.date);
  const eventsByEmpDate = groupBy(externalDailyEvents, (x) => `${x.date}::${x.employeeUid}`);
  const receiptsByDate = groupBy(externalDailyReceipts, (x) => x.date);

  const externalDates = new Set<string>([
    ...Object.keys(hoursByDate),
    ...Object.keys(receiptsByDate),
  ]);
  const allDates = new Set<string>([...sheetDateList, ...externalDates]);

  const sheetEmpKeys = new Set(sheetEmpDayRows.map((r) => `${r.date}::${r.employeeUid}`));
  const externalEmpKeys = new Set(Object.keys(eventsByEmpDate));
  const allEmpKeys = new Set<string>([...sheetEmpKeys, ...externalEmpKeys]);

  // ---------- 3) 日期级对账 ----------
  const days: ReconciledDay[] = [];
  const issues: ReconciliationIssue[] = [];

  for (const date of allDates) {
    const sheet = sheetDayTotals.get(date) ?? zeroDayTotals();

    const extTips = sumBy(receiptsByDate[date] ?? [], (r) => r.ccTips);
    const extSvc = sumBy(receiptsByDate[date] ?? [], (r) => r.serviceCharge);

    // Variances
    const vCcTips = varianceOfCents(
      sheet.ccTips,
      extTips,
      { absTolCents: rules.tipsToleranceAbsCents, pctTol: rules.tipsTolerancePct },
      'EXTERNAL',
    );
    if (vCcTips.status !== 'OK') {
      issues.push({
        level: vCcTips.status,
        code: 'TIPS_MISMATCH',
        message: `Credit card tips differ on ${date}: Sheet = ${formatCents(sheet.ccTips)}, External = ${formatCents(extTips)}.`,
        date,
        meta: { sheetCcTips: sheet.ccTips, externalCcTips: extTips },
      });
    }

    const vSvc = varianceOfCents(
      sheet.serviceCharge,
      extSvc,
      {
        absTolCents: rules.serviceChargeToleranceAbsCents,
        pctTol: rules.serviceChargeTolerancePct,
      },
      'EXTERNAL',
    );
    // Do not send service charge issues for now
    // if (vSvc.status !== 'OK') {
    //   issues.push({
    //     level: vSvc.status,
    //     code: 'SERVICE_CHARGE_MISMATCH',
    //     message: `Service charge totals don't match on ${date}: Sheet = ${formatCents(sheet.serviceCharge)}, External = ${formatCents(extSvc)}.`,
    //     date,
    //     meta: { sheetServiceCharge: sheet.serviceCharge, externalServiceCharge: extSvc },
    //   });
    // }

    // Clover 负值告警
    for (const r of receiptsByDate[date] ?? []) {
      if (r.ccTips < 0) {
        issues.push({
          level: 'WARNING',
          code: 'CLOVER_NEGATIVE_NET',
          message: `Clover reported negative credit card tips on ${date}.`,
          date,
          meta: { ccTips: r.ccTips },
        });
      }
    }

    days.push({
      date,
      totals: sheet,
      reconciliation: {
        ccTips: vCcTips,
        serviceCharge: vSvc,
      },
    });
  }

  // ---------- 4) 员工 × 日 对账（hours） ----------
  const employees: EmployeeDayReconciliation[] = [];

  for (const key of allEmpKeys) {
    const [date, employeeUid] = key.split('::');
    const inSheet = sheetEmpKeys.has(key);
    const extDailyEvents = eventsByEmpDate[key] ?? [];
    const sheetRow = inSheet
      ? sheetEmpDayRows.find((r) => r.date === date && r.employeeUid === employeeUid)!
      : zeroEmployeeDay(date, employeeUid, extDailyEvents[0]?.displayName || employeeUid);

    // 数据质量 issue
    for (const d of extDailyEvents) {
      if (d.quality === 'INCOMPLETE' || d.hasAnomaly) {
        for (const anomaly of d.anomalies ?? []) {
          let code = '';
          let message = '';
          if (anomaly.type === 'MISSING_CLOCKOUT') {
            code = 'EXTERNAL_MISSING_CLOCKOUT';
            message = `${d.displayName} did not clock out on ${d.date}.`;
          } else if (anomaly.type === 'MISSING_CLOCKIN') {
            code = 'EXTERNAL_MISSING_CLOCKIN';
            message = `${d.displayName} did not clock in on ${d.date}.`;
          } else if (anomaly.type === 'MISSING_ROLE') {
            code = 'EXTERNAL_MISSING_ROLE';
            message = `Role information is missing for ${d.displayName} on ${d.date}.`;
          } else {
            code = 'EXTERNAL_UNKNOWN_ANOMALY';
            message = `An unknown anomaly was detected for ${d.displayName} on ${d.date}.`;
          }

          issues.push({
            level: anomaly.level || 'WARNING',
            code: code,
            message: anomaly.note || message,
            employeeUid,
            displayName: d.displayName,
            date: d.date,
            meta: { anomaly, provider: d.provider },
          });
        }
      }
    }

    const validExtDailyEvents = extDailyEvents.filter(
      (d) => !!d.roleId && !!d.roleName && d.payRate && d.payType && d.position,
    ); // 仅保留可用的记录 (完整 role/payType/payRate)

    const sheetEmpByRole = groupBy(sheetRow.segments ?? [], (s) => s.roleId);
    const extEventsByRole = groupBy(validExtDailyEvents, (h) => h.roleId!);
    const allRoles = new Set<string>([
      ...Object.keys(sheetEmpByRole),
      ...Object.keys(extEventsByRole),
    ]);

    const reconciliationByRole: Record<
      string,
      {
        hours: Variance<number>;
      }
    > = {};
    for (const role of allRoles) {
      if (!includeRoleIds.includes(role)) continue; // 仅限 FOH 角色对账
      const sheetHoursForRole = sumBy(sheetEmpByRole[role] ?? [], (s) => s.hours);
      const extHoursForRole = sumBy(extEventsByRole[role] ?? [], (h) => h.hours);
      const vRoleHours = varianceOfNumber(
        sheetHoursForRole,
        extHoursForRole,
        { absTol: rules.hoursToleranceAbs, pctTol: rules.hoursTolerancePct },
        'EXTERNAL',
      );
      if (vRoleHours.status !== 'OK') {
        issues.push({
          level: vRoleHours.status,
          code: 'HOURS_MISMATCH_BY_ROLE',
          message: `Working hours differ for ${sheetRow.displayName} on ${date} (${role}): Sheet = ${sheetHoursForRole}h, External = ${extHoursForRole}h.`,
          date,
          employeeUid,
          displayName: sheetRow.displayName,
          meta: {
            roleId: role,
            sheetHours: sheetHoursForRole,
            externalHours: extHoursForRole,
          },
        });
      }
      reconciliationByRole[role] = {
        hours: vRoleHours,
      };
    }

    const segments: SheetRoleSlice[] = [];
    // 汇总各 role, 只取external(homebase)的有效打卡记录
    for (const [role, events] of Object.entries(extEventsByRole)) {
      const sheetSegmentForRole = sheetEmpByRole[role] ?? [];
      if (sheetSegmentForRole.length === 0 && events.length === 0) continue;

      const firstExt = events[0];
      const firstSheet = sheetSegmentForRole[0];

      const segmentHours =
        sumBy(events, (s) => s.hours) || sumBy(sheetSegmentForRole, (s) => s.hours);
      segments.push({
        roleId: firstExt?.roleId ?? firstSheet?.roleId ?? 'unknown',
        roleName: firstExt.roleName ?? firstSheet?.roleName ?? 'Unknown',
        position: firstExt?.position ?? firstSheet?.position ?? 'FRONT_OF_HOUSE',
        payType: firstExt?.payType ?? firstSheet?.payType ?? 'HOURLY',
        payRate: firstExt?.payRate ?? firstSheet?.payRate ?? 0,
        hours: clamp2(segmentHours),
        ccTips: sumBy(sheetSegmentForRole, (s) => s.ccTips),
        cashTips: sumBy(sheetSegmentForRole, (s) => s.cashTips),
      });
    }

    const overallVar = varianceOfNumber(
      sumBy(sheetRow.segments || [], (h) => h.hours),
      sumBy(validExtDailyEvents, (h) => h.hours),
      { absTol: rules.hoursToleranceAbs, pctTol: rules.hoursTolerancePct },
      'EXTERNAL',
    );

    const totalHours = sumBy(Object.values(extEventsByRole), (arr) => sumBy(arr, (h) => h.hours));

    employees.push({
      date,
      employeeUid,
      displayName: sheetRow.displayName,
      segments,
      totals: {
        hours: clamp2(totalHours),
        // 这里取 sheet 端的 tips 数据，因为segment里可能不包含个别sheet行（如真实打卡记录缺失）
        ccTips: sumBy(sheetRow.segments || [], (s) => s.ccTips),
        cashTips: sumBy(sheetRow.segments || [], (s) => s.cashTips),
      },
      reconciliation: {
        [OVERALL_ROLE_KEY]: {
          hours: overallVar,
        },
        ...reconciliationByRole,
      },
    });
  }

  // ---------- 5) 汇总 & 报告 ----------
  const sheetTotalCcTips = days.reduce((acc, d) => acc + d.totals.ccTips, 0);
  const sheetTotalServiceCharge = days.reduce((acc, d) => acc + d.totals.serviceCharge, 0);
  const employeeTotalCcTips = employees.reduce((acc, e) => acc + e.totals.ccTips, 0);
  const metaReconciliation = varianceOfCents(
    sheetTotalCcTips + sheetTotalServiceCharge,
    employeeTotalCcTips,
    { absTolCents: rules.tipsToleranceAbsCents, pctTol: rules.tipsTolerancePct },
    'SHEET',
  );
  if (metaReconciliation.status !== 'OK') {
    issues.push({
      level: 'WARNING',
      code: 'META_TIPS_MISMATCH',
      message: `Overall tip totals differ between sheet and employee summaries: Sheet = ${formatCents(sheetTotalCcTips)}, Employees = ${formatCents(employeeTotalCcTips)}.`,
      meta: {
        sheetTotalCcTips,
        employeeTotalCcTips,
      },
    });
  }

  const score = computeScore(issues.map((i) => i.level));
  const report = {
    issues,
    score,
  };

  // ---------- 6) meta ----------
  const meta: PayrollReconciledSummary['meta'] = {
    generatedAt: new Date().toISOString(),
    timezone,
    currency,
    locationId: payrollState.meta.locationId,
    locationState: payrollState.meta.locationState,
    minimumWage: payrollState.meta.minPayRate,
    configHash: JSON.stringify({ rules }).slice(0, 120),
    provenance: { hours: 'HOMEBASE', ccTips: 'CLOVER', serviceCharge: 'CLOVER' },
    timeClockEventsByEmpKey: groupBy(
      externalDailyEvents.filter((e) => !!e.roleName),
      (e) => e.employeeUid,
    ),
  };

  days.sort((a, b) => a.date.localeCompare(b.date));
  employees.sort((a, b) =>
    a.date === b.date ? a.employeeUid.localeCompare(b.employeeUid) : a.date.localeCompare(b.date),
  );

  return {
    days,
    employees,
    report,
    meta,
  };
}

// 小工具：零总计/零员工行
function zeroDayTotals(): ReconciledDay['totals'] {
  return { ccTips: 0, serviceCharge: 0, cashTips: 0 };
}

function zeroEmployeeDay(
  date: string,
  employeeUid: string,
  displayName: string,
): SheetEmployeeDayRow {
  return {
    date,
    employeeUid,
    displayName,
    segments: [],
  };
}
