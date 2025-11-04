import { MoneyCents, Ratio } from './number';

export type Position = 'FRONT_OF_HOUSE' | 'BACK_OF_HOUSE' | 'SPREAD_OF_HOURS'; // 1 FOH, 2 BOH, -1 Spread等虚拟
export type PayType = 'HOURLY' | 'SALARY';
export type LogType = 1 | 2 | 3 | 4 | 5; // 1是payroll,2是period,3是employee, 4，5预定为新的period/employee变更日志
export type PeriodField = 'sales' | 'cashTips' | 'ccTips' | 'serviceCharge' | 'busserPercent';
export type EmployeeField = 'hour' | 'percent' | 'cc' | 'cash';

export type PeriodId =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14';
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export type Meal = 'lunch' | 'dinner';

export type StatePeriod = {
  id: string; // periodId
  sales: MoneyCents;
  cashTips: MoneyCents;
  ccTips: MoneyCents;
  serviceCharge: MoneyCents;
  busserPercent: Ratio;
  // 派生汇总可有可无（计算时可再得）
};

export type StateEmployeeCell = {
  hour: number;
  cc: MoneyCents;
  cash: MoneyCents;
  percent: Ratio;
  // 派生汇总可有可无（计算时可再得）
};

export type StateEmployee = {
  uid: string;
  roleId: string;
  roleName: string;
  name: string;
  payRate: MoneyCents;
  payType: PayType;
  byPeriod: Record<string, StateEmployeeCell>; // 稀疏OK
};

export type StateLogEntry = {
  type: LogType;
  timestamp: string; // ISO
  operatorName: string;
  raw: any; // 原始数据，按 type 解析
};

export type PayrollState = {
  meta: {
    payrollId: string;
    locationId: string;
    locationName: string;
    minPayRate: MoneyCents;
    startDateISO: string;
    endDateISO: string;
    totalCashTips?: MoneyCents;
    totalTips?: MoneyCents;
  };
  periods: Record<string, StatePeriod>;
  employees: StateEmployee[]; // 全部在册（含DB里没记录的零值）
  logs: StateLogEntry[];
};

export type PayrollChange =
  | ({ kind: 'period' } & PeriodUpdate)
  | ({ kind: 'employee' } & EmployeeUpdate);

export type PeriodUpdate = {
  periodId: string;
  field: PeriodField;
  value: MoneyCents | Ratio;
};

export type EmployeeUpdate = {
  periodId: string;
  uid: string;
  roleName: string;
  field: EmployeeField;
  value: MoneyCents | Ratio | number; // percent as 0..1
};

export type PeriodChangeDiff = {
  periodId: string;
  field: PeriodField;
  before?: MoneyCents | Ratio; // cents or ratio(0..1)
  after?: MoneyCents | Ratio;
};

export type EmployeeChangeDiff = {
  periodId: string;
  uid: string;
  roleName: string;
  field: EmployeeField;
  before?: MoneyCents | Ratio | number; // cents or hour/ratio
  after?: MoneyCents | Ratio | number;
};

export type PayrollDiff = {
  periods: PeriodChangeDiff[];
  employees: EmployeeChangeDiff[];
  meta: {
    totalCashTips?: { before?: MoneyCents; after?: MoneyCents };
    totalTips?: { before?: MoneyCents; after?: MoneyCents };
  };
};
