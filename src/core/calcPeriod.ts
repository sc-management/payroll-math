import { PeriodCalcInput, PeriodCalcResult } from './types';

export function calculatePeriodTotals(input: PeriodCalcInput): PeriodCalcResult {
  const totalTips = Math.round((input.ccTips + input.sc) * 100) / 100;
  const tipsPercent = input.sales === 0 ? 0 : +(totalTips / input.sales).toFixed(4);
  return { totalTips, tipsPercent };
}
