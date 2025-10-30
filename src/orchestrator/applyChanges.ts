import {
  EmployeeUpdate,
  PayrollChange,
  PayrollDiff,
  PayrollState,
  PeriodUpdate,
} from '../state/payroll-types';
import { clamp01, sumCents } from '../state/number';
import { resolveDependencies } from './resolve';
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
  let actualAffected: {
    periods: Set<string>;
    employees: Set<string>;
    roles: Set<string>;
  } | null = null;
  const normalized = normalizeChanges(changes);
  const affectedHint = resolveDependencies(current, normalized);

  // 复制 + 直接落格子更改 + 重算受影响区域
  const nextState: PayrollState = produce(current, (draft) => {
    applyDirectEdits(draft, normalized);
    actualAffected = recomputeAffected(draft, affectedHint);
    recomputeMetaTotals(draft);
  });

  // 生成 diff（用于写库/日志）
  // 使用 recompute 实际写入结果的受影响集合，确保 diff 与真实落库一致
  const diff = buildDiff(current, nextState, actualAffected ?? affectedHint);

  const next = nextState;
  return { next, affected: actualAffected ?? affectedHint, diff };
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
