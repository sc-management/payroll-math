import { MoneyCents } from '../state/number';
import { PayType, Position } from '../state/payroll-types';
import { ExternalTimeClockEvent } from './input-types';

export type VarianceStatus = 'OK' | 'WARNING' | 'ERROR';
export type ExternalProvider = 'HOMEBASE' | 'CLOVER' | 'OTHER';

export type Variance<T extends number> = {
  sheet: T;
  external: T;
  delta: T; // sheet - external
  pct?: number; // |delta| / max(external, ε)
  status: VarianceStatus;
  note?: string;

  source: 'EXTERNAL' | 'SHEET'; // ✅ 保留统一语义
  provider?: ExternalProvider; // ✅ 指明外部来源（可选）
};

export type SheetRoleSlice = {
  roleId: string;
  roleName: string;
  position: Position;
  payRate: MoneyCents;
  payType: PayType;
  hours: number;
  ccTips: MoneyCents;
  cashTips: MoneyCents;
};

export type EmployeeDayReconciliation = {
  date: string; // YYYY-MM-DD（门店时区）
  employeeUid: string;
  displayName: string;

  // ✅ 汇总级工时对账
  reconciliation: Record<
    string,
    {
      hours: Variance<number>;
    }
  >; // keyed by roleName (总览每个 role 的工时差异）

  /** 仅展示用途（可省略） */
  segments?: SheetRoleSlice[];
  totals: {
    hours: number; // sheet 当日总工时（reg+OT）
    ccTips: MoneyCents;
    cashTips: MoneyCents;
  };
};

export type ReconciledDay = {
  date: string; // YYYY-MM-DD（门店时区）

  totals: {
    /** sheet 当日总工时（reg+OT） */
    hours: number;

    /** sheet 当日的“直传”金额（用于 UI 展示；对账只发生在下面两项） */
    cashTips: MoneyCents;

    /** 对账基数（来自 sheet） */
    ccTips: MoneyCents;
    serviceCharge: MoneyCents;
  };
  reconciliation: {
    // ✅ 期级工时总览（把员工小时汇总后再对一遍）
    hours: Variance<number>;

    // ✅ 金额对账只做 ccTips / serviceCharge（来自 Clover）
    ccTips: Variance<MoneyCents>;
    serviceCharge: Variance<MoneyCents>;
  };
};

export type ReconciliationIssue = {
  level: 'INFO' | 'WARNING' | 'ERROR';
  code: string; // 预定义问题代码 e.g. 'HB_OVERLAP_SHIFT' | 'HB_MISSING_CLOCKOUT' | 'MAP_MISSING_EMPLOYEE'
  message: string; // 人类可读
  employeeUid?: string;
  displayName?: string;
  date?: string;
  meta?: Record<string, any>;
};

export type ReconciliationReport = {
  issues: ReconciliationIssue[];
  score?: number; // 0..100
};

export type PayrollReconciledSummary = {
  days: ReconciledDay[];
  employees: EmployeeDayReconciliation[];
  report: ReconciliationReport;
  meta: {
    schemaVersion?: string; // ✅ 版本演进更安全
    generatedAt: string; // ISO8601
    timezone?: string; // 门店时区（用来解释日级归属）
    currency?: string; // e.g. 'USD'
    locationId: string; // 多门店场景常用
    minimumWage: MoneyCents;

    configHash?: string; // 用于变更检测
    sourceHashes?: { payrollState?: string; externalTimeClocks?: string; externalTips?: string };

    provenance?: {
      hours?: 'HOMEBASE' | 'OTHER';
      ccTips?: 'CLOVER' | 'OTHER';
      serviceCharge?: 'CLOVER' | 'OTHER';
    };
    timeClockEventsByEmpKey?: Record<string, ExternalTimeClockEvent[]>;
  };
};
