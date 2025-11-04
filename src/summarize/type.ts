import { MoneyCents } from '../state/number';
import { PayType, Position } from '../state/payroll-types';
import {
  PayrollReconciledSummary,
  ReconciledDay,
  ReconciliationReport,
  Variance,
} from '../reconcile/types';

export const OVERALL_ROLE_KEY = '__OVERALL__';

export type DailyMismatch = {
  date: string; // yyyy-MM-dd
  roleId: string;
  roleName: string;
  type: 'HOURS' | 'TIPS' | 'SERVICE_CHARGE';
  field: string; // 例如 'hours', 'ccTips', 'serviceCharge'
  variance: Variance<number>;
  note?: string;
};

export type RoleSummary = {
  roleId: string;
  roleName: string;
  payRate: MoneyCents;
  payType: PayType;
  position: Position;

  regularHours: number;
  overtimeHours: number;
  overtimeMultiplier: number;
  wages: MoneyCents;
};

export type WeeklyEmployeeSummary = {
  employeeUid: string;
  displayName: string;
  hoursByRole: Record<string, RoleSummary>;
  totals: {
    regularHours: number;
    overtimeHours: number;
    spreadOfHours: number;
    wages: MoneyCents;
    ccTips: MoneyCents;
    cashTips: MoneyCents;

    gross: MoneyCents;
    boh: {
      hours: number;
      wages: MoneyCents;
    };
    foh: {
      hours: number;
      wages: MoneyCents;
    };
  };
  reconciliation: {
    roles: Record<string, Variance<number>>;
    [OVERALL_ROLE_KEY]: Variance<number>;
  };

  /** ⬇️ 每天的不匹配快照 */
  dailyMismatches?: DailyMismatch[];
};

export type WeeklySummary = {
  range: {
    startDate: string; // yyyy-MM-dd
    endDate: string; // yyyy-MM-dd
  };
  employees: WeeklyEmployeeSummary[];
  days: Array<Pick<ReconciledDay, 'date' | 'totals' | 'reconciliation'>>;
  totals: {
    hours: number;
    ccTips: MoneyCents;
    cashTips: MoneyCents;
    serviceCharge: MoneyCents;
  };
  meta: PayrollReconciledSummary['meta'];
  report?: Pick<ReconciliationReport, 'score' | 'issues'> & {
    issueCountByLevel?: { INFO: number; WARNING: number; ERROR: number };
    blocking?: boolean; // 是否存在阻断提交的 ERROR
  };
};
