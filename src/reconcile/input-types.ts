import { ExternalProvider } from './types';
import { MoneyCents } from '../state/number';
import { PayrollState, PayType, Position } from '../state/payroll-types';

export type LocalDate = string; // YYYY-MM-DD

export type ExternalShiftAnomalyType = 'MISSING_CLOCKOUT' | 'MISSING_CLOCKIN' | 'MISSING_ROLE';

export type ExternalShiftAnomaly = {
  clockId?: string; // providerClockId（若有的话）
  type: ExternalShiftAnomalyType;
  in?: string; // ISO(UTC) 原始 clockIn
  out?: string; // ISO(UTC) 原始 clockOut（缺失时为空）
  note?: string; // 自由文本说明
};

export type ExternalTimeClockEvent = {
  date: LocalDate; // YYYY-MM-DD（门店时区）
  employeeUid: string;
  displayName: string;
  hours: number;
  roleId?: string;
  roleName?: string;
  payRate?: MoneyCents;
  payType?: PayType;
  position?: Position;

  clockIn: string; // ISO(UTC) 原始 clockIn, 用来排序

  // 质量与溯源（用于在 report/audit 里给出线索）
  provider?: ExternalProvider;
  clockRefs?: string[];
  quality?: 'OK' | 'INCOMPLETE';
  hasAnomaly?: boolean; // ✅ 便捷旗标（由后端根据 anomalies 是否为空置 true）
  anomalies?: ExternalShiftAnomaly[]; // 列举当日的异常（如缺 clockout）
  meta?: Record<string, any>;
};

export type ExternalDailyNetReceipts = {
  date: LocalDate;
  ccTips: MoneyCents;
  serviceCharge: MoneyCents;
  provider?: ExternalProvider;
  meta?: Record<string, any>;
};

export type ReconcileInput = {
  payrollState: PayrollState;
  externalDailyEvents: ExternalTimeClockEvent[];
  externalDailyReceipts: ExternalDailyNetReceipts[];

  timezone?: string;
  currency?: string;
};
