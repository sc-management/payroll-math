export interface RawPayrollWithFull {
  id: number;
  location_id: number;
  start_date: Date;
  end_date: Date;
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
    bus_percent: number;
  }>;
  employeeRecords: Array<{
    id: number;
    uid: number;
    payroll_id: number;
    period_id: number;
    role_id: number;
    role_name?: string | null;
    pay_rate?: number | null;
    pay_type?: number | null;
    hour?: number | null;
    tips_cc?: number | null;
    tips_cash?: number | null;
    percent?: number | null;
  }>;
  location: {
    id: number;
    name: string;
    min_pay_rate: number;
  };
  logs: Array<{
    type: number;
    update_data: string;
    timestamp: Date;
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
