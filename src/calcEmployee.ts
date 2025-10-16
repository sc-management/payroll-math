import { EmployeeCalcInput, EmployeeCalcResult } from "./types";
import { round0, round2, max0 } from "./math";

export function calculateEmployee(input: EmployeeCalcInput): EmployeeCalcResult {
    const {
        roleId, payRate, payType, hour, minPayRate,
        currentCc, currentCash, percent, period,
        otherRoleTotalCcTips, otherRoleTotalCashTips,
        bartenderTotalCcTips, bartenderTotalCashTips,
        hostTotalCcTips, hostTotalCashTips,
        othersPercentage,
        otherPeriodTotalHours, otherPeriodTotalCc, otherPeriodTotalCash
    } = input;

    const hourlyPayment = payType === 1 ? hour * payRate : payRate;

    let tipsCc = 0, tipsCash = 0;
    if (roleId === 1) {
        // Server
        tipsCc  = hour > 0 ? max0(period.totalTips - otherRoleTotalCcTips) * percent : 0;
        tipsCash= hour > 0 ? max0(period.cashTips - otherRoleTotalCashTips) * percent : 0;
    } else if (roleId === 2) {
        // Busser
        const ccPool   = max0(period.totalTips - bartenderTotalCcTips - hostTotalCcTips);
        const cashPool = max0(period.cashTips - bartenderTotalCashTips - hostTotalCashTips);
        tipsCc  = hour > 0 ? ccPool   * period.busPercent * percent : 0;
        tipsCash= hour > 0 ? cashPool * period.busPercent * percent : 0;
    } else {
        // 其他：直接用输入
        tipsCc = currentCc;
        tipsCash = currentCash;
    }

    tipsCc = round0(tipsCc);
    tipsCash = round0(tipsCash);

    const total = (hour + tipsCc + tipsCash) === 0
        ? 0
        : round0(Math.max(hourlyPayment + tipsCc + tipsCash, hour * minPayRate));

    // —— 累计口径（跨 period）——
    const totalHour = round2(otherPeriodTotalHours + hour);
    const totalHourlyPayment = payType === 1 ? totalHour * payRate : payRate;
    const totalTipsCcOnly = otherPeriodTotalCc + tipsCc;
    const totalCashOnly   = otherPeriodTotalCash + tipsCash;

    // 先用 cc 与小时工资去够最低工资，不够再从 cash 补
    const needToMeet = minPayRate * totalHour;
    const preCash    = totalHourlyPayment + totalTipsCcOnly;
    const cashReport = preCash < needToMeet ? Math.min(totalCashOnly, needToMeet - preCash) : 0;

    // 仍不足则 scMakeup 计入 totalTips
    const hourPayPlusTipsPlusCash = totalHourlyPayment + totalTipsCcOnly + cashReport;
    const scMakeup = hourPayPlusTipsPlusCash < needToMeet ? (needToMeet - hourPayPlusTipsPlusCash) : 0;

    const totalTipsOut = round0(totalTipsCcOnly + scMakeup);
    const rolePercentage = othersPercentage + percent * 100;

    return {
        tipsCc,
        tipsCash,
        total,
        totalHour,
        cashReport: round0(cashReport),
        totalTips: totalTipsOut,
        rolePercentage,
        tipsUpdated: false
    };
}
