export interface RawPayrollWithFull {
  id: number;
  location_id: number;
  start_date: string;
  end_date: string;
  total_cash_tips: number;
  total_tips: number;
  periodRecords: Array<{
    id: number;
    payroll_id: number;
    period_id: number;
    sales: number;
    cash_tips: number;
    cc_tips: number;
    sc: number;
    tips_total: number;
    bus_percent: number;
  }>;
  employeeRecords: Array<{
    id: number;
    uid: number;
    payroll_id: number;
    period_id: number;
    role_id: number;
    role_name: string;
    pay_rate: number;
    pay_type: number;
    hour: number;
    tips_cc: number;
    tips_cash: number;
    tips_total: number;
    percent: number;
  }>;
  location: {
    id: number;
    name: string;
    min_pay_rate: number;
    time_periods?: string;
  };
  logs: Array<{
    type: number;
    update_data: string;
    timestamp: string;
    member: {
      first_name: string;
      last_name: string;
    };
  }>;
}

export interface RawPayRateRecord {
  id: number;
  uid: number;
  role_id: number;
  location_id: number;
  pay_rate: number;
  pay_type: number | null;
  role: { id: number; name: string };
  member: { uid: number; first_name: string; last_name: string };
}
