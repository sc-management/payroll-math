import { PayRateRecord, PayrollSnapshot } from '../types/backend';
import { RawPayRateRecord, RawPayrollWithFull } from '../types/backend-raw';
import { LogType, PayrollState, StateEmployee, StateLogEntry } from './payroll-types';
import { clamp01, floatToCents, num } from './number';

const ROLE_LABEL: Record<'1' | '2' | '3' | '4', 'Server' | 'Busser' | 'Bartender' | 'Host'> = {
  '1': 'Server',
  '2': 'Busser',
  '3': 'Bartender',
  '4': 'Host',
};

const ALLOWED_ROLE_IDS = new Set<string>(['1', '2', '3', '4']);

function getEmployeeMeta(uid: string, payRates: PayRateRecord[]) {
  const pr = payRates.find((p) => p.uid === uid);
  const name =
    [pr?.member?.firstName, pr?.member?.lastName].filter(Boolean).join(' ').trim() || `(#${uid})`;
  return {
    name,
    payRate: num(pr?.payRate),
    payType: pr?.payType === 2 ? ('SALARY' as const) : ('HOURLY' as const),
  };
}

function toSorted(m: Map<string, StateEmployee>) {
  return Array.from(m.values()).sort((a, b) => a.uid.localeCompare(b.uid));
}

function parseLogEntry(entry: PayrollSnapshot['logs'][number]): StateLogEntry {
  const operatorName =
    [entry.member?.firstName, entry.member?.lastName].filter(Boolean).join(' ') || 'Unknown';
  let raw: any;
  try {
    raw = JSON.parse(entry.updateData);
  } catch {
    raw = entry.updateData;
  }
  return {
    type: entry.type as LogType,
    timestamp: entry.timestamp,
    operatorName,
    raw,
  };
}

export function canonicalizeSnapshot(raw: RawPayrollWithFull): PayrollSnapshot {
  return {
    id: String(raw.id),
    locationId: String(raw.location_id),
    startDate: raw.start_date.toISOString(),
    endDate: raw.end_date.toISOString(),
    totalCashTips: raw.total_cash_tips,
    totalTips: raw.total_tips,
    periodRecords: raw.periodRecords.map((r) => ({
      id: String(r.id),
      payrollId: String(r.payroll_id),
      periodId: String(r.period_id),
      sales: r.sales,
      cashTips: r.cash_tips,
      ccTips: r.cc_tips,
      serviceCharge: r.sc,
      busserPercent: r.bus_percent,
    })),
    employeeRecords: raw.employeeRecords.map((e) => ({
      id: String(e.id),
      uid: String(e.uid),
      payrollId: String(e.payroll_id),
      periodId: String(e.period_id),
      roleId: String(e.role_id),
      roleName: e.role_name || 'Unknown',
      payRate: e.pay_rate || 0,
      payType: e.pay_type || 1,
      hour: e.hour || 0,
      tipsCc: e.tips_cc || 0,
      tipsCash: e.tips_cash || 0,
      percent: e.percent || 0,
    })),
    location: {
      id: String(raw.location.id),
      name: raw.location.name,
      minPayRate: raw.location.min_pay_rate,
    },
    logs: raw.logs.map((l) => ({
      type: l.type,
      updateData: l.update_data,
      timestamp: l.timestamp.toISOString(),
      member: {
        firstName: l.member.first_name,
        lastName: l.member.last_name,
      },
    })),
  };
}

export function canonicalizePayRate(r: RawPayRateRecord): PayRateRecord {
  return {
    id: String(r.id),
    uid: String(r.uid),
    roleId: String(r.role_id),
    locationId: String(r.location_id),
    payRate: r.pay_rate,
    payType: r.pay_type,
    role: {
      id: String(r.role.id),
      name: r.role.name,
    },
    member: {
      uid: String(r.member.uid),
      firstName: r.member.first_name,
      lastName: r.member.last_name,
    },
  };
}

// canonical -> PayrollState（金额转 cents、比例 clamp 等）
export function fromCanonicalToState(snap: PayrollSnapshot, rates: PayRateRecord[]): PayrollState {
  const periods: PayrollState['periods'] = {};
  for (const p of snap.periodRecords) {
    periods[p.periodId] = {
      id: p.periodId,
      sales: floatToCents(p.sales),
      cashTips: floatToCents(p.cashTips),
      ccTips: floatToCents(p.ccTips),
      serviceCharge: floatToCents(p.serviceCharge),
      busserPercent: clamp01(p.busserPercent ?? 0),
    };
  }

  const buckets: {
    '1': Map<string, StateEmployee>;
    '2': Map<string, StateEmployee>;
    '3': Map<string, StateEmployee>;
    '4': Map<string, StateEmployee>;
  } = { 1: new Map(), 2: new Map(), 3: new Map(), 4: new Map() };

  /** 根据 payRates 预埋四类岗位的所有员工 */
  for (const pr of rates) {
    const roleId = pr?.roleId as '1' | '2' | '3' | '4' | undefined;
    const uid = pr?.uid;
    if (!uid || !roleId || !ALLOWED_ROLE_IDS.has(roleId)) continue;

    const roleName = ROLE_LABEL[roleId];
    const bucket = buckets[roleId];

    if (!bucket.has(uid)) {
      const name =
        [pr.member?.firstName, pr.member?.lastName].filter(Boolean).join(' ').trim() || String(uid);

      bucket.set(uid, {
        uid,
        roleId,
        roleName,
        name,
        payRate: floatToCents(pr.payRate),
        payType: pr.payType === 2 ? 'SALARY' : 'HOURLY',
        byPeriod: {},
      });
    }
  }

  for (const rec of snap.employeeRecords) {
    if (!ALLOWED_ROLE_IDS.has(rec.roleId)) continue;

    const roleId = rec.roleId as '1' | '2' | '3' | '4';
    const roleName = ROLE_LABEL[roleId];
    const bucket = buckets[roleId];
    const uid = rec.uid;

    if (!bucket.has(uid)) {
      // payRates里没找到也要兜底加上（名字/薪资尽力取到）
      const meta = getEmployeeMeta(uid, rates);
      bucket.set(uid, {
        uid,
        roleId,
        roleName,
        name: meta.name,
        payRate: floatToCents(meta.payRate),
        payType: meta.payType,
        byPeriod: {},
      });
    }

    const row = bucket.get(uid);
    if (!row) continue; // 类型保护
    const pid = rec.periodId;

    row.byPeriod[pid] = {
      hour: rec.hour,
      cc: floatToCents(rec.tipsCc),
      cash: floatToCents(rec.tipsCash),
      percent: clamp01(rec.percent ?? 0),
    };
  }

  const employees: PayrollState['employees'] = [
    ...toSorted(buckets['1']),
    ...toSorted(buckets['2']),
    ...toSorted(buckets['3']),
    ...toSorted(buckets['4']),
  ];

  const meta: PayrollState['meta'] = {
    payrollId: snap.id,
    locationId: snap.location.id,
    locationName: snap.location.name,
    minPayRate: floatToCents(snap.location.minPayRate),
    startDateISO: snap.startDate,
    endDateISO: snap.endDate,
    totalCashTips: floatToCents(snap.totalCashTips),
    totalTips: floatToCents(snap.totalTips),
  };

  return {
    meta,
    periods,
    employees,
    logs: (snap.logs ?? []).map(parseLogEntry),
  };
}

// 入口：给后端/前端用的通用方法
export function fromBackendSnapshotToState(raw: RawPayrollWithFull, rawRates: RawPayRateRecord[]) {
  const snap = canonicalizeSnapshot(raw);
  const rates = rawRates.map(canonicalizePayRate);
  return fromCanonicalToState(snap, rates);
}
