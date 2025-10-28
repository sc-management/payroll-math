export type PeriodTotalInput = {
  ccTips: number;
  sc: number;
  cashTips: number;
};

export function sumPayrollTotals(periods: PeriodTotalInput[]) {
  const sum = (ns: number[]) => Math.round(ns.reduce((a, b) => a + b, 0));
  // Treat missing/NaN as 0
  periods = periods.map((p) => ({
    ccTips: isNaN(p.ccTips) || p.ccTips === undefined ? 0 : p.ccTips,
    sc: isNaN(p.sc) || p.sc === undefined ? 0 : p.sc,
    cashTips: isNaN(p.cashTips) || p.cashTips === undefined ? 0 : p.cashTips,
  }));
  const totalTips = sum(periods.map((p) => p.ccTips + p.sc));
  const totalCashTips = sum(periods.map((p) => p.cashTips));
  return { totalTips, totalCashTips };
}
