export type RoleId = 1 | 2 | 3 | 4 | number; // 1: Server, 2: Busser, 3: Bartender, 4: Host

export interface PeriodInfo {
    periodId: number;
    sales: number;
    ccTips: number;
    sc: number;
    cashTips: number;
    totalTips: number;   // ccTips + sc
    busPercent: number;  // 0.1 => 10%
}

export interface PeriodCalcInput {
    sales: number;
    ccTips: number;
    sc: number;
    cashTips: number;
    state?: string;
}
export interface PeriodCalcResult {
    totalTips: number;   // ccTips + sc
    tipsPercent: number; // totalTips / sales (4 位小数)
}

export interface EmployeeCalcInput {
    roleId: RoleId;
    payRate: number;
    payType: 1 | 2;        // 1 hourly, 2 salary
    hour: number;
    minPayRate: number;

    currentCc: number;
    currentCash: number;
    percent: number;       // 0.25 表示 25%

    period: PeriodInfo;

    otherRoleTotalCcTips: number;
    otherRoleTotalCashTips: number;
    bartenderTotalCcTips: number;
    bartenderTotalCashTips: number;
    hostTotalCcTips: number;
    hostTotalCashTips: number;

    othersPercentage: number;   // 其他同角色的百分比总和（单位：百分数，如 25）
    otherPeriodTotalHours: number;
    otherPeriodTotalCc: number;
    otherPeriodTotalCash: number;
}

export interface EmployeeCalcResult {
    tipsCc: number;
    tipsCash: number;
    total: number;          // 本段显示总额（含 min pay 兜底）四舍五入到整数
    totalHour: number;      // 累计小时（含其它段）
    cashReport: number;     // 报现金（整数）
    totalTips: number;      // 累计小费（含 sc_makeup）
    rolePercentage: number; // othersPercentage + 自己( percent*100 )
    tipsUpdated: boolean;   // 仅给前端联动用，纯计算置 false
}
