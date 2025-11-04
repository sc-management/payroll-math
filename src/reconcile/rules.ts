export type ReconciliationConfig = {
  // 工时容差
  hoursToleranceAbs: number; // 允许的工时绝对误差（小时）
  hoursTolerancePct: number; // 允许的工时相对误差（百分比，0..1）

  // 金额容差（单位：分）
  tipsToleranceAbsCents: number; // 例如 200 ($2)
  tipsTolerancePct: number; // 例如 0.03
  serviceChargeToleranceAbsCents: number; // 例如 200
  serviceChargeTolerancePct: number; // 例如 0.03
};

export const defaultRules: ReconciliationConfig = {
  hoursToleranceAbs: 2, // 2 hours
  hoursTolerancePct: 0.05, // 5%
  tipsToleranceAbsCents: 5000, // $50
  tipsTolerancePct: 0.03, // 3%
  serviceChargeToleranceAbsCents: 5000, // $50
  serviceChargeTolerancePct: 0.03, // 3%
};
