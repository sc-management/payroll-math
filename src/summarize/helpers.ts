import { Variance, VarianceStatus } from '../reconcile/types';
const EPS = 1e-6 as const;

export function worstStatus(a: VarianceStatus, b: VarianceStatus): VarianceStatus {
  const rank = { ERROR: 2, WARNING: 1, OK: 0 } as const;
  return rank[a] >= rank[b] ? a : b;
}

export function addVariance(
  a: Variance<number> | undefined,
  b: Variance<number>,
): Variance<number> {
  if (!a)
    return {
      sheet: b.sheet,
      external: b.external,
      delta: b.sheet - b.external,
      pct: Math.abs(b.sheet - b.external) / Math.max(b.external, EPS),
      status: b.status,
      // 周级合并后的 source/provider 没有单一来源意义，通常不保留或留空
      source: 'EXTERNAL',
    };

  const sheet = a.sheet + b.sheet;
  const external = a.external + b.external;
  const delta = sheet - external;
  return {
    sheet,
    external,
    delta,
    pct: Math.abs(delta) / Math.max(external, EPS),
    status: worstStatus(a.status, b.status),
    source: 'EXTERNAL',
  };
}
