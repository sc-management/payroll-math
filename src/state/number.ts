export type MoneyCents = number; // 全程用分
export type Ratio = number; // 0..1，进入时 clamp

export const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const empKey = (uid: string | number, periodId: string | number) => `${periodId}:${uid}`;
export const clamp01 = (x: number): Ratio => Math.max(0, Math.min(1, x));

export function floatToCents(n: number | string): MoneyCents {
  if (typeof n === 'string') {
    const [i, f = ''] = n.split('.');
    const f2 = (f + '00').slice(0, 2);
    return Number(i) * 100 + Number(f2);
  }
  return Math.round((n + Number.EPSILON) * 100);
}

export const centsToFloat = (c: MoneyCents) => Math.round(c) / 100;

export const sumCents = (xs: MoneyCents[]) => xs.reduce((a, b) => a + b, 0);

// 稳定整分分摊：按权重/顺序把余数的几分钱分掉
export function stableDistributeCents(total: MoneyCents, weights: number[]): MoneyCents[] {
  const s = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / s);
  const floors = raw.map((x) => Math.floor(x));
  let rem = total - floors.reduce((a, b) => a + b, 0);
  // 余分给“小数部分较大”的人，保证稳定性可再加固定排序键
  const fracIdx = raw.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < rem; k++) floors[fracIdx[k][1]]++;
  return floors;
}
