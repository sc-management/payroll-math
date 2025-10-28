import { MinPayAdjustInput, MinPayAdjustResult } from './types';

export function applyMinimumPayAdjustment(input: MinPayAdjustInput): MinPayAdjustResult {
  const { regularHours, overtimeHours, payAmount, tips, tipsCash, bonus, minPayRate } = input;
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const minimumPay = minPayRate * regularHours + 1.5 * minPayRate * overtimeHours;
  const hourPay = payAmount - tips - bonus;

  const newTipsCash = round2(Math.min(Math.max(minimumPay - payAmount, 0), tipsCash));
  const newTips = round2(Math.max(tips, minimumPay - hourPay - newTipsCash));
  const newPayAmount = round2(Math.max(payAmount, minimumPay));

  return {
    tips: newTips,
    tipsCash: newTipsCash,
    payAmount: newPayAmount,
    minimumPay: round2(minimumPay),
  };
}
