// tests/variance.test.ts
import { describe, it, expect } from 'vitest';

// ⬇️ 按你的真实路径调整
import type { Variance } from '../src';
import { addVariance, worstStatus } from '../src/summarize/helpers';

const EPS = 1e-6;

describe('worstStatus', () => {
  it('ERROR > WARNING > OK', () => {
    expect(worstStatus('OK', 'WARNING')).toBe('WARNING');
    expect(worstStatus('WARNING', 'OK')).toBe('WARNING');

    expect(worstStatus('ERROR', 'OK')).toBe('ERROR');
    expect(worstStatus('OK', 'ERROR')).toBe('ERROR');

    expect(worstStatus('ERROR', 'WARNING')).toBe('ERROR');
    expect(worstStatus('WARNING', 'ERROR')).toBe('ERROR');

    expect(worstStatus('OK', 'OK')).toBe('OK');
    expect(worstStatus('WARNING', 'WARNING')).toBe('WARNING');
    expect(worstStatus('ERROR', 'ERROR')).toBe('ERROR');
  });
});

describe('addVariance', () => {
  it('初始化：a 为 undefined 时直接返回基于 b 的汇总（含 delta/pct/source）', () => {
    const b: Variance<number> = {
      sheet: 120,
      external: 100,
      delta: 20,
      status: 'WARNING',
      source: 'EXTERNAL',
    };

    const r = addVariance(undefined, b);
    expect(r.sheet).toBe(120);
    expect(r.external).toBe(100);
    expect(r.delta).toBe(20);
    expect(r.pct!).toBeCloseTo(Math.abs(20) / Math.max(100, EPS), 12);
    expect(r.status).toBe('WARNING');
    expect(r.source).toBe('EXTERNAL');
  });

  it('合并：数值相加、delta/pct 基于总和计算、status 取最差', () => {
    const b1: Variance<number> = {
      sheet: 120,
      external: 100,
      delta: 20,
      status: 'WARNING',
      source: 'EXTERNAL',
    };
    const b2: Variance<number> = {
      sheet: 80,
      external: 100,
      delta: -20,
      status: 'OK',
      source: 'EXTERNAL',
    };

    const a1 = addVariance(undefined, b1);
    const r = addVariance(a1, b2);

    expect(r.sheet).toBe(200);
    expect(r.external).toBe(200);
    expect(r.delta).toBe(0);
    expect(r.pct!).toBeCloseTo(0, 12);
    expect(r.status).toBe('WARNING'); // worst(WARNING, OK) = WARNING
    expect(r.source).toBe('EXTERNAL'); // 周级/合并后统一为 EXTERNAL
  });

  it('external 为 0 时 pct 使用 EPS 做分母保护', () => {
    const b: Variance<number> = {
      sheet: 10,
      external: 0,
      delta: 10,
      status: 'ERROR',
      source: 'EXTERNAL',
    };
    const r = addVariance(undefined, b);
    expect(r.delta).toBe(10);
    expect(r.pct!).toBeCloseTo(Math.abs(10) / Math.max(0, EPS), 6); // 约等于 1e7
    expect(r.status).toBe('ERROR');
  });

  it('结合律：不同合并顺序得到相同结果', () => {
    const v1: Variance<number> = {
      sheet: 50,
      external: 40,
      delta: 10,
      status: 'OK',
      source: 'EXTERNAL',
    };
    const v2: Variance<number> = {
      sheet: 30,
      external: 50,
      delta: -20,
      status: 'WARNING',
      source: 'EXTERNAL',
    };
    const v3: Variance<number> = {
      sheet: 20,
      external: 20,
      delta: 0,
      status: 'OK',
      source: 'EXTERNAL',
    };

    const left = addVariance(addVariance(addVariance(undefined, v1), v2), v3);
    const right = addVariance(addVariance(addVariance(undefined, v3), v2), v1);

    expect(left.sheet).toBe(right.sheet);
    expect(left.external).toBe(right.external);
    expect(left.delta).toBe(right.delta);
    expect(left.pct!).toBeCloseTo(right.pct!, 12);
    expect(left.status).toBe(right.status);
    expect(left.source).toBe('EXTERNAL');
    expect(right.source).toBe('EXTERNAL');
  });
});
