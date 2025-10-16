// src/spread.ts
import { ShiftRecord, SpreadResult } from './payroll-types';

export interface SpreadInput {
  records: ShiftRecord[];
  minPayRate: number;
  enabled?: boolean; // 默认 true；非 NY 传 false 关掉
  thresholdHours?: number; // 默认 10；万一法规变动可以外部传
  onlyIfExtraHoursPositive?: boolean;
  extraHoursFromSource?: number;
}

export function computeSpreadOfHours(input: SpreadInput): SpreadResult {
  const {
    records,
    minPayRate,
    enabled = true,
    thresholdHours = 10,
    onlyIfExtraHoursPositive = true,
    extraHoursFromSource = 0,
  } = input;

  if (!enabled) return { spreadHours: 0, spreadPay: 0, perDate: [] };
  if (onlyIfExtraHoursPositive && extraHoursFromSource <= 0) {
    return { spreadHours: 0, spreadPay: 0, perDate: [] };
  }

  const perDate: Array<{ date: string; hours: number; pay: number }> = [];
  let spreadHours = 0;

  for (const r of records) {
    if (r.payType === 1 && r.hour >= thresholdHours) {
      spreadHours += 1;
      perDate.push({ date: r.date, hours: 1, pay: minPayRate });
    }
  }

  return { spreadHours, spreadPay: spreadHours * minPayRate, perDate };
}
