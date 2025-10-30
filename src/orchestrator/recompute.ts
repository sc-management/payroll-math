import { PayrollState } from '../state/payroll-types';
import { Affected } from './resolve';
import { calculateEmployee } from '../core/calcEmployee';
import { max0 } from '../core/math';

const ROLE_ORDER = ['Host', 'Bartender', 'Busser', 'Server'] as const;

/* ---------- helpers ---------- */

const sumRoleCc = (s: PayrollState, pid: string, role: string) =>
  s.employees
    .filter((e) => e.roleName === role)
    .reduce((a, e) => a + (e.byPeriod[pid]?.cc ?? 0), 0);

const sumRoleCash = (s: PayrollState, pid: string, role: string) =>
  s.employees
    .filter((e) => e.roleName === role)
    .reduce((a, e) => a + (e.byPeriod[pid]?.cash ?? 0), 0);

function eq2(a1: number, a2: number, b1: number, b2: number) {
  return a1 === b1 && a2 === b2;
}

export function recomputeAffected(draft: PayrollState, affected: Affected): Affected {
  const actualAffected: Affected = {
    periods: new Set<string>(),
    employees: new Set<string>(),
    roles: new Set<string>(),
  };

  // 逐 period 处理
  for (const pid of affected.periods) {
    const period = draft.periods[pid];
    // period 可能被懒创建，或者仍不存在（例如只有员工级编辑）。不存在也不影响：服务端/客户端口径允许。
    const poolCash = period?.cashTips ?? 0;
    const poolCc = period?.ccTips ?? 0;
    const serviceCharge = period?.serviceCharge ?? 0;
    const busserPercent = period?.busserPercent ?? 0;
    const hasEmployeeKeysForPid = Array.from(affected.employees).some((k) =>
      k.startsWith(`${pid}:`),
    );

    for (const role of ROLE_ORDER) {
      const roleIsAffected = affected.roles.size === 0 || affected.roles.has(role);
      const roleEmployees = draft.employees.filter((e) => {
        if (e.roleName !== role) return false;
        // 正常路径：有明确的逐员工集合 -> 只计算这些员工；
        // 兜底路径：没有逐员工集合 -> 仅当该角色受影响时计算该 period 下本角色的所有员工
        return hasEmployeeKeysForPid
          ? affected.employees.has(`${pid}:${e.uid}:${e.roleName}`)
          : roleIsAffected;
      });
      if (!roleEmployees.length) continue;

      // 依赖项：其他角色/优先角色的当前总计（以最新 draft 为准，顺序已确保）
      const bartenderTotalCcTips = sumRoleCc(draft, pid, 'Bartender');
      const bartenderTotalCashTips = sumRoleCash(draft, pid, 'Bartender');
      const hostTotalCcTips = sumRoleCc(draft, pid, 'Host');
      const hostTotalCashTips = sumRoleCash(draft, pid, 'Host');

      for (const e of roleEmployees) {
        const before = e.byPeriod[pid]; // 可能不存在

        // 读取“输入侧”的 percent/当前手改数值（如果没有 cell 则默认为 0；不会因此创建 cell）
        const percent = before?.percent ?? 0;
        const currentCc = before?.cc ?? 0;
        const currentCash = before?.cash ?? 0;

        // 计算目标结果（不立即落盘，先比较）
        const res = calculateEmployee({
          roleName: role,
          cc: currentCc,
          cash: currentCash,
          percent,
          ccPoolAfterOthers: max0(poolCc + serviceCharge - bartenderTotalCcTips - hostTotalCcTips),
          cashPoolAfterOthers: max0(poolCash - bartenderTotalCashTips - hostTotalCashTips),
          busserPercent,
        });

        // 对比：如果 cell 原本不存在，并且算出的 cc/cash/total 都是 0，则不创建，不标记变动
        if (!before && res.tipsCc === 0 && res.tipsCash === 0) continue;

        // 如果存在，且新旧两值都相同，则不写入、不标记
        if (before && eq2(before.cc ?? 0, before.cash ?? 0, res.tipsCc, res.tipsCash)) continue;

        // —— 这里才真正写回（懒创建 cell）——
        const cell = (e.byPeriod[pid] ||= {
          hour: 0,
          cc: 0,
          cash: 0,
          percent: 0,
        });
        cell.cc = res.tipsCc;
        cell.cash = res.tipsCash;

        // 标记变动
        actualAffected.periods.add(pid);
        actualAffected.employees.add(`${pid}:${e.uid}:${e.roleName}`);
        actualAffected.roles.add(role);
      }
    }
  }

  return actualAffected;
}
