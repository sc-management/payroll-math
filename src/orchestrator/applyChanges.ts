import {
  EmployeeUpdate,
  PayrollChange,
  PayrollDiff,
  PayrollState,
  PeriodUpdate,
} from '../state/payroll-types';
import { clamp01, sumCents } from '../state/number';
import { Affected, resolveDependencies } from './resolve';
import { produce } from 'immer';
import { applyDirectEdits } from './direct-edits';
import { buildDiff } from './diff';
import { recomputeAffected } from './recompute';

export type ApplyOptions = {
  // 性能优化/一致性控制
  strict?: boolean; // 默认 true：发现不合法数据直接抛错
  stableRounding?: boolean; // 保证相同输入顺序下舍入稳定
};

export type ApplyStateResult = {
  next: PayrollState; // ✅ 直接返回下一个 State
  affected: {
    periods: Set<string>;
    employees: Set<string>; // `${periodId}:${uid}`
    roles: Set<string>;
  };
  diff: PayrollDiff; // 字段级 before/after
};

export function applyChanges(current: PayrollState, changes: PayrollChange[]): ApplyStateResult {
  // 归一化 + 依赖传播
  let affected: Affected = {
    periods: new Set<string>(),
    employees: new Set<string>(),
    roles: new Set<string>(),
  };
  const normalized = normalizeChanges(changes);

  // 复制 + 直接落格子更改 + 重算受影响区域
  const nextState: PayrollState = produce(current, (draft) => {
    applyDirectEdits(draft, normalized);
    affected = resolveDependencies(draft, normalized);
    recomputeAffected(draft, affected);
    recomputeMetaTotals(draft);

    pruneAfterRecompute(current, draft, affected);
  });

  // 生成 diff（用于写库/日志）
  // 使用 recompute 实际写入结果的受影响集合，确保 diff 与真实落库一致
  const diff = buildDiff(current, nextState, affected);

  const next = nextState;
  return { next, affected, diff };
}

function normalizeChanges(changes: PayrollChange[]): PayrollChange[] {
  return changes.map((c) => {
    if (c.kind === 'period') {
      const p = c as PeriodUpdate;
      return { ...c, periodId: String(p.periodId) } as PayrollChange;
    }
    const e = c as EmployeeUpdate;
    return {
      ...c,
      periodId: String(e.periodId),
      uid: String(e.uid),
      value: e.field === 'percent' ? clamp01(e.value) : e.value,
    } as PayrollChange;
  });
}

function recomputeMetaTotals(state: PayrollState) {
  const totalCash = sumCents(Object.values(state.periods).map((p) => p.cashTips));
  const totalCc = sumCents(Object.values(state.periods).map((p) => p.ccTips));
  state.meta.totalCashTips = totalCash;
  state.meta.totalTips = totalCash + totalCc;
}

// ---- Shake Tree: prune cells that are meaningless after recompute ----
function isZeroishCell(cell: any): boolean {
  if (!cell) return true;
  const hour = cell.hour ?? 0;
  const percent = cell.percent ?? 0;
  const cc = cell.cc ?? 0;
  const cash = cell.cash ?? 0;
  return hour === 0 && percent === 0 && cc === 0 && cash === 0;
}

function pruneAfterRecompute(before: PayrollState, after: PayrollState, affected: Affected) {
  // Build a quick lookup for "before" employees by uid+role
  const beforeIndex = new Map<string, any>();
  for (const be of (before as any).employees ?? []) {
    const key = `${be.uid}:${be.roleName}`;
    beforeIndex.set(key, be);
  }

  for (const pid of affected.periods) {
    // Iterate all employees in "after"
    for (const e of (after as any).employees ?? []) {
      const key = `${e.uid}:${e.roleName}`;
      // Narrowing: if affected.employees 非空，仅处理被点名的员工；否则处理受影响角色
      const named =
        affected.employees.size > 0
          ? affected.employees.has(`${pid}:${e.uid}:${e.roleName}`)
          : affected.roles.has(e.roleName);
      if (!named) continue;

      const afterCell = e.byPeriod?.[pid];
      if (!afterCell) continue; // nothing to prune

      const beforeCell = beforeIndex.get(key)?.byPeriod?.[pid];
      // 规则：如果 after 是全 0 且（before 不存在 或 before 也是全 0），则删除该 cell
      if (isZeroishCell(afterCell) && (beforeCell == null || isZeroishCell(beforeCell))) {
        // delete without breaking Immer drafts
        if (e.byPeriod) {
          delete e.byPeriod[pid];
        }
      }
    }
  }
}
