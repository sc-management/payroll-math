import { describe, it, expect } from "vitest";
import { calculateEmployee, PeriodInfo } from "../src";

const p: PeriodInfo = {
    periodId: 2, sales: 1000, ccTips: 500, sc: 100, cashTips: 200, totalTips: 600, busPercent: 0.1
};

describe("employee calc (server)", () => {
    it("server splits by percent (minus other roles)", () => {
        const r = calculateEmployee({
            roleId: 1, payRate: 10, payType: 1, hour: 8, minPayRate: 15,
            currentCc: 0, currentCash: 0, percent: 0.25,
            period: p,
            otherRoleTotalCcTips: 100, otherRoleTotalCashTips: 50,
            bartenderTotalCcTips: 0, bartenderTotalCashTips: 0,
            hostTotalCcTips: 0, hostTotalCashTips: 0,
            othersPercentage: 50,
            otherPeriodTotalHours: 4, otherPeriodTotalCc: 50, otherPeriodTotalCash: 20
        });
        expect(r.tipsCc).toBe(Math.round((600 - 100) * 0.25));
        expect(r.tipsCash).toBe(Math.round((200 - 50) * 0.25));
        expect(r.rolePercentage).toBeCloseTo(75);
    });
});
