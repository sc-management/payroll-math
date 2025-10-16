export type PeriodTotalInput = {
  ccTips: number;
  sc: number;
  cashTips: number;
};

export function sumPayrollTotals(periods: PeriodTotalInput[]) {
  const sum = (ns: number[]) => Math.round(ns.reduce((a, b) => a + b, 0));
  const totalTips = sum(periods.map((p) => p.ccTips + p.sc));
  const totalCashTips = sum(periods.map((p) => p.cashTips));
  return { totalTips, totalCashTips };
}
