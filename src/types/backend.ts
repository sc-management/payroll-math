export interface PayrollSnapshot {
  id: string;
  locationId: string;
  startDate: string; // ISO
  endDate: string; // ISO
  totalCashTips: number; // 注意：还是浮点/字符串，只负责“形状”，单位转换在适配器做
  totalTips: number;

  periodRecords: Array<{
    id: string;
    payrollId: string;
    periodId: string;
    sales: number;
    cashTips: number;
    ccTips: number;
    serviceCharge: number;
    tipsTotal: number;
    busserPercent: number; // 0..1
  }>;

  employeeRecords: Array<{
    id: string;
    uid: string;
    payrollId: string;
    periodId: string;
    roleId: string;
    roleName: string;
    payRate: number;
    payType: number;
    hour: number;
    tipsCc: number;
    tipsCash: number;
    tipsTotal: number;
    percent: number; // 0..1
  }>;

  location: {
    id: string;
    name: string;
    minPayRate: number;
    timePeriods?: string;
  };

  logs: Array<{
    type: number;
    updateData: string;
    timestamp: string;
    member: {
      firstName: string;
      lastName: string;
    };
  }>;
}

export interface PayRateRecord {
  id: string;
  uid: string;
  roleId: string;
  locationId: string;
  payRate: number;
  payType: number | null;
  role: { id: string; name: string };
  member: { uid: string; firstName: string; lastName: string };
}
