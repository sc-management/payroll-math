import { RoleWeeklyHours, ShiftRecord } from './types';
import { clamp2 } from '../state/number';

/**
 * 将一周内的所有打卡记录，按进入顺序依次分配到 regular / overtime。
 * - 先到 40 小时为 regular（跨记录切分）
 * - 超过 40 的部分记为 overtime
 * - 按 roleName 维度各自累计
 *
 * @param records 本周所有 ShiftRecord
 * @param weeklyCap 触发加班的阈值（默认 40h）
 */
export function computeWeeklyOvertimeByRole(
  records: ShiftRecord[],
  weeklyCap = 40,
): Record<string, RoleWeeklyHours> {
  // 复制并按 clockIn 排序（ISO 字符串可直接比较）
  const recs = [...records].sort((a, b) => a.clockIn.localeCompare(b.clockIn));

  const result: Record<string, RoleWeeklyHours> = {};
  let accumulated = 0; // 本周累计小时（跨 role）

  for (const r of recs) {
    const hours = Math.max(0, r.hour || 0); // 保护：负数当 0
    const remainingRegular = Math.max(0, weeklyCap - accumulated);

    const toRegular = Math.min(remainingRegular, hours);
    const toOvertime = hours - toRegular;

    if (!result[r.roleId]) {
      result[r.roleId] = { regularHours: 0, overtimeHours: 0 };
    }

    result[r.roleId].regularHours += toRegular;
    result[r.roleId].overtimeHours += toOvertime;

    accumulated += hours;
  }

  // 统一保留两位小数
  for (const role of Object.keys(result)) {
    result[role].regularHours = clamp2(result[role].regularHours);
    result[role].overtimeHours = clamp2(result[role].overtimeHours);
  }

  return result;
}
