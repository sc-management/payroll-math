import { describe, it, expect } from 'vitest';
import { makeEmployee, makeState, P1 } from './helpers/factories';
import { applyDirectEdits } from '../src/orchestrator/direct-edits';

describe('applyDirectEdits', () => {
  it('懒创建 period 并写入字段', () => {
    const state = makeState();
    applyDirectEdits(state, [
      { kind: 'period', periodId: P1, field: 'sales', value: 12345 },
      { kind: 'period', periodId: P1, field: 'ccTips', value: 200 },
      { kind: 'period', periodId: P1, field: 'busserPercent', value: 2 }, // clamp01 -> 1
    ]);

    expect(state.periods[P1]).toBeTruthy();
    expect(state.periods[P1].sales).toBe(12345);
    expect(state.periods[P1].ccTips).toBe(200);
    expect(state.periods[P1].busserPercent).toBe(1);
  });

  it('懒创建 employee cell 并写入字段（含 percent clamp）', () => {
    const emp = makeEmployee({ uid: '10', roleName: 'Server' });
    const state = makeState({ employees: [emp] });

    applyDirectEdits(state, [
      { kind: 'employee', periodId: P1, uid: '10', roleName: 'Server', field: 'hour', value: 5 },
      { kind: 'employee', periodId: P1, uid: '10', roleName: 'Server', field: 'cc', value: 300 },
      { kind: 'employee', periodId: P1, uid: '10', roleName: 'Server', field: 'cash', value: 100 },
      {
        kind: 'employee',
        periodId: P1,
        uid: '10',
        roleName: 'Server',
        field: 'percent',
        value: 1.5, // clamp
      },
    ]);

    const cell = state.employees[0].byPeriod[P1];
    expect(cell).toBeTruthy();
    expect(cell.hour).toBe(5);
    expect(cell.cc).toBe(300);
    expect(cell.cash).toBe(100);
    expect(cell.percent).toBe(1);
  });

  it('找不到员工则跳过不抛错', () => {
    const state = makeState();
    applyDirectEdits(state, [
      { kind: 'employee', periodId: P1, uid: '404', roleName: 'Server', field: 'cc', value: 1 },
    ]);
    // no throw, no data created
    expect(state.employees.length).toBe(0);
  });
});
