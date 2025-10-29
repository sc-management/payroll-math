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

  for (const c of changes) {
    if (c.kind === 'period') {
      const pid = c.periodId;
      periods.add(pid);
      for (const e of state.employees) {
        if (e.roleName === 'Server' || e.roleName === 'Busser') {
          employees.add(empKey(e.uid, pid, e.roleName));
          roles.add(e.roleName);
        }
      }
    } else if (c.kind === 'employee') {
      const pid = c.periodId;
      const uid = c.uid;
      const roleName = c.roleName;
      const e = state.employees.find((x) => x.uid === uid && x.roleName === roleName);
      if (e) {
        employees.add(empKey(e.uid, pid, e.roleName));
        roles.add(e.roleName);

        // 若是优先占用角色（host/bartender)，会影响 server和busser
        if (isPriorityRole(e.roleName)) {
          for (const se of state.employees) {
            if (se.roleName === 'Server' || se.roleName === 'Busser') {
              employees.add(empKey(se.uid, pid, se.roleName));
              roles.add(se.roleName);
            }
          }
        }
      }
    }
  }

  return { periods, employees, roles };
}
