// import { PayrollModel } from '../types/frontend';
// import { PayrollChange } from '../state/payroll-types';
//
// export type ApplyOptions = {
//   // 性能优化/一致性控制
//   strict?: boolean; // 默认 true：发现不合法数据直接抛错
//   stableRounding?: boolean; // 保证相同输入顺序下舍入稳定
// };
//
// export type ApplyResult = {
//   next: PayrollModel; // 重算后的模型（不可变）
//   affected: {
//     periods: Set<string>;
//     employees: Set<string>; // key: `${periodId}:${uid}`
//     roles: Set<string>;
//   };
//   // diff: PayrollDiff;         // 用于投影到 DB 的“变更前后对比”
// };
//
// export function applyChanges(
//   current: PayrollModel,
//   changes: PayrollChange[],
//   options?: ApplyOptions,
// ) {}
