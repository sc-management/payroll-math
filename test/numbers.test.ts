import { describe, it, expect } from 'vitest';
import {
  clamp01,
  empKey,
  floatToCents,
  num,
  stableDistributeCents,
  sumCents,
} from '../src/state/number';

describe('core/number helpers', () => {
  it('num() converts safely to number or 0', () => {
    expect(num(123)).toBe(123);
    expect(num('456')).toBe(456);
    expect(num('12.34')).toBe(12.34);
    expect(num('abc')).toBe(0);
    expect(num(NaN)).toBe(0);
    expect(num(Infinity)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num(null as any)).toBe(0);
  });

  it('empKey() concatenates in period:uid:role order', () => {
    expect(empKey('7', '1', 'Server')).toBe('1:7:Server');
    expect(empKey(42, 3, 'Host')).toBe('3:42:Host');
  });

  it('clamp01() clamps to [0,1]', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.3)).toBe(0.3);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(5)).toBe(1);
  });

  describe('floatToCents()', () => {
    it('parses string by truncating to 2 decimals', () => {
      expect(floatToCents('12')).toBe(1200);
      expect(floatToCents('12.3')).toBe(1230);
      expect(floatToCents('12.34')).toBe(1234);
      expect(floatToCents('12.3456')).toBe(1234); // string path truncates
    });

    it('rounds number with EPSILON', () => {
      expect(floatToCents(12)).toBe(1200);
      expect(floatToCents(12.3)).toBe(1230);
      expect(floatToCents(12.34)).toBe(1234);
      expect(floatToCents(12.345)).toBe(1235); // number path rounds
    });
  });

  it('sumCents() sums arrays of cents', () => {
    expect(sumCents([100, 200, 300])).toBe(600);
    expect(sumCents([])).toBe(0);
  });

  describe('stableDistributeCents()', () => {
    it('distributes whole cents proportionally and deterministically', () => {
      // total 10, weights [1,2,3] -> raw [1.666.., 3.333.., 5]
      // floors [1,3,5], remainder 1 goes to index with largest fraction (index 0)
      expect(stableDistributeCents(10, [1, 2, 3])).toEqual([2, 3, 5]);

      // total 5, weights [1,1,1] -> floors [1,1,1], remainder 2 -> first two indices
      expect(stableDistributeCents(5, [1, 1, 1])).toEqual([2, 2, 1]);

      // total 5, weights [1,2] -> raw [1.666.., 3.333..] -> [2,3]
      expect(stableDistributeCents(5, [1, 2])).toEqual([2, 3]);
    });

    it('handles zero-sum weights with small totals (fallback s=1)', () => {
      // sum(weights)=0 path; keep total <= weights.length to avoid overshoot
      expect(stableDistributeCents(2, [0, 0, 0])).toEqual([1, 1, 0]);
      expect(stableDistributeCents(1, [0, 0])).toEqual([1, 0]);
    });
  });
});
