import { describe, it, expect } from 'vitest';
import { computeSpreadOfHours, PayType, Position } from '../src';

describe('computeSpreadOfHours', () => {
  it('returns zero spread when disabled', () => {
    const input = {
      records: [
        {
          date: '2025-02-01',
          hour: 12,
          payRate: 15,
          payType: 1 as PayType,
          position: 1 as Position,
        },
      ],
      minPayRate: 10,
      enabled: false,
    };
    const res = computeSpreadOfHours(input);
    expect(res.spreadHours).toBe(0);
    expect(res.spreadPay).toBe(0);
    expect(res.perDate?.length).toBe(0);
  });

  it('requires positive extra hours when onlyIfExtraHoursPositive is true', () => {
    const input = {
      records: [
        {
          date: '2025-02-02',
          hour: 11,
          payRate: 12,
          payType: 1 as PayType,
          position: 1 as Position,
        },
      ],
      minPayRate: 10,
      extraHoursFromSource: 0,
      // `onlyIfExtraHoursPositive` defaults to true
    };
    const res = computeSpreadOfHours(input);
    expect(res.spreadHours).toBe(0);
    expect(res.spreadPay).toBe(0);
    expect(res.perDate?.length).toBe(0);
  });

  it('counts one hour per qualifying shift and computes spread pay', () => {
    const input = {
      records: [
        {
          date: '2025-02-03',
          hour: 12,
          payRate: 15,
          payType: 1 as PayType,
          position: 1 as Position,
        },
        {
          date: '2025-02-04',
          hour: 9,
          payRate: 15,
          payType: 1 as PayType,
          position: 2 as Position,
        },
      ],
      minPayRate: 10,
      extraHoursFromSource: 2, // positive to enable spread
    };
    const res = computeSpreadOfHours(input);
    // Only the 12‑hour shift (payType 1) meets threshold (>=10 hours)
    expect(res.spreadHours).toBe(1);
    expect(res.spreadPay).toBe(10);
    expect(res.perDate).toEqual([{ date: '2025-02-03', hours: 1, pay: 10 }]);
  });

  it('respects custom thresholdHours and counts salary vs hourly correctly', () => {
    const input = {
      records: [
        {
          date: '2025-02-05',
          hour: 6,
          payRate: 15,
          payType: 1 as PayType,
          position: 1 as Position,
        },
        {
          date: '2025-02-06',
          hour: 8,
          payRate: 15,
          payType: 2 as PayType,
          position: 2 as Position,
        },
      ],
      minPayRate: 12,
      thresholdHours: 5,
      extraHoursFromSource: 1,
    };
    const res = computeSpreadOfHours(input);
    // With threshold=5, the 6‑hour hourly shift qualifies; salary shift is ignored【347430897149071†L31-L34】
    expect(res.spreadHours).toBe(1);
    expect(res.spreadPay).toBe(12);
    expect(res.perDate).toEqual([{ date: '2025-02-05', hours: 1, pay: 12 }]);
  });
});
