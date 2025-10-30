import { PayrollChange, PayrollState } from '../state/payroll-types';
import { empKey } from '../state/number';

export type Affected = {
  periods: Set<string>;
  employees: Set<string>;
  roles: Set<string>;
};

export function resolveDependencies(state: PayrollState, changes: PayrollChange[]): Affected {
  const periods = new Set<string>();
  const employees = new Set<string>();
  const roles = new Set<string>();

  const isPriorityRole = (roleName: string) => roleName === 'Host' || roleName === 'Bartender';
  // employees explicitly mentioned by this batch (considered "newly added" if they had no cell before)
  const directEmployeeKeys = new Set<string>();
  for (const c of changes) {
    if (c.kind === 'employee') {
      directEmployeeKeys.add(empKey(c.uid, c.periodId, c.roleName));
    }
  }
  const hasCell = (e: any, pid: string) => !!e.byPeriod?.[pid];

  for (const c of changes) {
    if (c.kind === 'period') {
      const pid = c.periodId;
      // period 有 change => period 必须加入
      periods.add(pid);

      // 仅当字段是会影响分配的池子字段时，扩散到 Server/Busser
      const poolFields = new Set(['ccTips', 'cashTips', 'serviceCharge']);
      const fieldName = c.field;
      if (fieldName && poolFields.has(fieldName)) {
        for (const e of state.employees) {
          if (e.roleName === 'Server' || e.roleName === 'Busser') {
            const key = empKey(e.uid, pid, e.roleName);
            // 若该员工在该 period 下没有 cell，则只有当这次变更里“直接点名了该员工”才加入
            if (hasCell(e, pid) || directEmployeeKeys.has(key)) {
              employees.add(key);
              roles.add(e.roleName);
            }
          }
        }
      }
    } else if (c.kind === 'employee') {
      const pid = c.periodId;
      const uid = c.uid;
      const roleName = c.roleName;
      const key = empKey(uid, pid, roleName);
      // employee 有 change => employee 必须加入（不把 period 放进 periods）
      employees.add(key);
      roles.add(roleName);

      // 若是优先占用角色（host/bartender)，会影响 server和busser
      if (isPriorityRole(roleName)) {
        for (const se of state.employees) {
          if (se.roleName === 'Server' || se.roleName === 'Busser') {
            const sKey = empKey(se.uid, pid, se.roleName);
            if (hasCell(se, pid) || directEmployeeKeys.has(sKey)) {
              employees.add(sKey);
              roles.add(se.roleName);
            }
          }
        }
      }
    }
  }

  return { periods, employees, roles };
}
