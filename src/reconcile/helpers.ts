import { ReconciliationIssue, Variance, VarianceStatus } from './types';
import { clamp01, clamp2, MoneyCents } from '../state/number';

const EPS = 1e-9;

export function pctOf(absDelta: number, base: number) {
  const denom = Math.max(Math.abs(base), EPS);
  return clamp01(absDelta / denom);
}

export function statusFromDelta(
  deltaAbs: number,
  base: number,
  absTol: number,
  pctTol: number,
): VarianceStatus {
  const effTol = Math.max(absTol, pctTol * Math.max(Math.abs(base), EPS));
  if (deltaAbs <= effTol) return 'OK';
  if (deltaAbs <= effTol * 2) return 'WARNING';
  return 'ERROR';
}

export function varianceOfNumber(
  sheet: number,
  external: number,
  conf: { absTol: number; pctTol: number },
  source: 'EXTERNAL' | 'SHEET',
): Variance<number> {
  const delta = sheet - external;
  const absDelta = Math.abs(delta);
  const pct = pctOf(absDelta, external);
  return {
    sheet: clamp2(sheet),
    external: clamp2(external),
    delta: clamp2(delta),
    pct,
    status: statusFromDelta(absDelta, external, conf.absTol, conf.pctTol),
    source,
  };
}

export function varianceOfCents(
  sheet: MoneyCents,
  external: MoneyCents,
  conf: { absTolCents: number; pctTol: number },
  source: 'EXTERNAL' | 'SHEET',
): Variance<MoneyCents> {
  const delta = sheet - external;
  const absDelta = Math.abs(delta);
  const pct = pctOf(absDelta, external);
  return {
    sheet,
    external,
    delta,
    pct,
    status: statusFromDelta(absDelta, external, conf.absTolCents, conf.pctTol),
    source,
  };
}

// ---------- 聚合工具 ----------

export function sumBy<T>(arr: T[], pick: (x: T) => number): number {
  let s = 0;
  for (const it of arr) s += pick(it) || 0;
  return s;
}

export function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  const m: Record<string, T[]> = {};
  for (const it of arr) {
    const k = key(it);
    (m[k] ||= []).push(it);
  }
  return m;
}

// ---------- 评分（可简化/替换） ----------
export function computeScore(levels: Array<ReconciliationIssue['level']>): number {
  if (!levels.length) return 100;
  let score = 100;
  for (const s of levels) {
    if (s === 'WARNING') score -= 5;
    else if (s === 'ERROR') score -= 20;
  }
  return Math.max(0, Math.min(100, score));
}
