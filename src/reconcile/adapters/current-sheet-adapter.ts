import { SheetAdapter, SheetEmployeeDayRow, SheetDayTotals } from '../sheet-adapter';
import { PayrollState, Position, StateEmployee } from '../../state/payroll-types';
import { addDays, isValid, parseISO } from 'date-fns';
import { MoneyCents } from '../../state/number';
import { formatInTimeZone } from 'date-fns-tz';

/** periodId -> YYYY-MM-DD 的解析函数 */
export type PeriodToDateResolver = (periodId: string, meta: PayrollState['meta']) => string;

/**
 * 默认解析器：
 * - periodId 是 "1".."14" 的顺序,1 表示 Day-1 午餐，2 表示 Day-1 晚餐，依此类推
 * - 以 meta.startDateISO 为 Day-1（含）起点
 */
export const defaultPeriodToDate: PeriodToDateResolver = (periodId, meta) => {
  const base = parseISO(meta.startDateISO);
  if (!isValid(base))
    throw new Error(`[reconcile] invalid meta.startDateISO: ${meta.startDateISO}`);
  const n = Number(periodId);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`[reconcile] unexpected periodId="${periodId}" for default resolver`);
  }
  const d = addDays(base, Math.floor((n - 1) / 2)); // 每两 periodId 增加一天
  // 输出“YYYY-MM-DD”（不带时间）
  return formatInTimeZone(d, 'UTC', 'yyyy-MM-dd');
};

export type CurrentSheetAdapterDateOptions = {
  periodIdToDate?: PeriodToDateResolver;
};

/**
 * 将现有 PayrollState（period-based）适配为“按日期”的 SheetAdapter。
 * - 日期 = periodId 经 resolver 映射
 * - dayTotals：period 金额按日期累加；hours 从 employees.byPeriod.hour 聚合
 * - employee×day：从 employees[].byPeriod[periodId].hour 聚合到当天
 */
export function makeCurrentSheetAdapterDate(
  opts: CurrentSheetAdapterDateOptions = {},
): SheetAdapter {
  const { periodIdToDate = defaultPeriodToDate } = opts;

  return {
    listDates(state: PayrollState): string[] {
      const dates = new Set<string>();

      // 从 periods 抓日期
      for (const pid of Object.keys(state.periods ?? {})) {
        dates.add(periodIdToDate(pid, state.meta));
      }

      // 从员工 period cell 抓日期（防止有 periodKey 在 employee 侧但 periods 里缺）
      for (const emp of state.employees ?? []) {
        for (const pid of Object.keys(emp.byPeriod ?? {})) {
          dates.add(periodIdToDate(pid, state.meta));
        }
      }

      return Array.from(dates).sort();
    },
    getDayTotals(state: PayrollState, date: string): SheetDayTotals {
      // 1) 找到映射到该 date 的所有 periodId
      const periodIdsForDay: string[] = [];
      for (const pid of Object.keys(state.periods ?? {})) {
        if (periodIdToDate(pid, state.meta) === date) periodIdsForDay.push(pid);
      }

      // 还要考虑 employee.byPeriod 里存在但 periods 里没有的 periodId
      for (const emp of state.employees ?? []) {
        for (const pid of Object.keys(emp.byPeriod ?? {})) {
          if (periodIdToDate(pid, state.meta) === date && !periodIdsForDay.includes(pid)) {
            periodIdsForDay.push(pid);
          }
        }
      }

      // 2) 金额：从 StatePeriod 按日期累加（缺就 0）
      let ccTips = 0 as MoneyCents;
      let cashTips = 0 as MoneyCents;
      let serviceCharge = 0 as MoneyCents;

      for (const pid of periodIdsForDay) {
        const p = state.periods?.[pid];
        if (p) {
          ccTips += p.ccTips ?? 0;
          cashTips += p.cashTips ?? 0;
          serviceCharge += p.serviceCharge ?? 0;
        }
      }

      return {
        ccTips,
        serviceCharge,
        cashTips,
      };
    },
    listEmployeeDayRows(state: PayrollState): SheetEmployeeDayRow[] {
      const byKey = new Map<string, SheetEmployeeDayRow>();

      // 内部工具：取/建行
      const ensureRow = (date: string, emp: StateEmployee): SheetEmployeeDayRow => {
        const key = `${date}::${emp.uid}`;
        let row = byKey.get(key);
        if (!row) {
          row = {
            date,
            employeeUid: emp.uid,
            displayName: emp.name || emp.uid,
            segments: [],
          };
          byKey.set(key, row);
        } else if (!row.displayName && (emp.name || emp.uid)) {
          // 如果之前是占位的 uid，这里用有名字的覆盖一下
          row.displayName = emp.name || emp.uid;
        }
        return row;
      };

      // 内部工具：在行里合并/新增 segment
      const upsertSegment = (
        row: SheetEmployeeDayRow,
        emp: StateEmployee,
        addHours: number,
        addCc: number,
        addCash: number,
      ) => {
        if (!row.segments) row.segments = [];

        // 以 roleId 为主、roleName 为辅去重
        const idx = row.segments.findIndex((s) => s.roleName === emp.roleName);

        if (idx >= 0) {
          const seg = row.segments[idx];
          seg.hours += addHours; // 汇总字段
          seg.ccTips += addCc;
          seg.cashTips += addCash;
        } else {
          row.segments.push({
            roleId: emp.roleId,
            roleName: emp.roleName,
            payRate: emp.payRate,
            payType: emp.payType,
            position: 'FRONT_OF_HOUSE' as Position, // 默认 FOH

            hours: addHours, // regular + overtime
            ccTips: addCc,
            cashTips: addCash,
          });
        }
      };

      for (const emp of state.employees ?? []) {
        const cells = emp.byPeriod ?? {};
        for (const [pid, cell] of Object.entries(cells)) {
          if (!cell) continue;
          const date = periodIdToDate(pid, state.meta);
          const hours = Number(cell.hour) || 0;
          const cc = Number(cell.cc) || 0;
          const cash = Number(cell.cash) || 0;

          // 若该段完全为 0，是否也要生成？通常没意义，跳过
          if (hours === 0 && cc === 0 && cash === 0) continue;

          const row = ensureRow(date, emp);
          upsertSegment(row, emp, hours, cc, cash);
        }
      }

      // 稳定排序：先按 date，再按 uid
      return Array.from(byKey.values()).sort((a, b) =>
        a.date === b.date
          ? a.employeeUid.localeCompare(b.employeeUid)
          : a.date.localeCompare(b.date),
      );
    },
  };
}
