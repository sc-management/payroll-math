import { MinPayAdjustInput, MinPayAdjustResult } from './types';

export function applyMinimumPayAdjustment(input: MinPayAdjustInput): MinPayAdjustResult {
  const { regularHours, overtimeHours, payAmount, tips, tipsCash, bonus, minimumWage } = input;

  const minimumPay = minimumWage * regularHours + 1.5 * minimumWage * overtimeHours;
  const hourPay = payAmount - tips - bonus;

  const newTipsCash = Math.min(Math.max(minimumPay - payAmount, 0), tipsCash);
  const newTips = Math.max(tips, minimumPay - hourPay - newTipsCash);

  return {
    tips: newTips,
    tipsCash: newTipsCash,
  };
}
