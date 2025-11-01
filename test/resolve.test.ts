import { describe, it, expect } from 'vitest';
import { resolveDependencies } from '../src/orchestrator/resolve';
import { makeEmployee, makeState, P1 } from './helpers/factories';

// empKey 形如 `${periodId}:${uid}:${roleName}`，resolve.ts 内部使用

describe('resolveDependencies', () => {
  it('period 级变更影响 Server/Busser 员工集合与对应角色', () => {
    const state = makeState({
      employees: [
        makeEmployee({
          uid: '1',
          roleName: 'Server',
          byPeriod: {
            [P1]: {
              hour: 40,
              cc: 200,
              cash: 100,
              percent: 20,
            },
          },
        }),
        makeEmployee({ uid: '2', roleName: 'Busser' }),
        makeEmployee({ uid: '3', roleName: 'Host' }),
      ],
    });

    const res = resolveDependencies(state, [
      { kind: 'period', periodId: P1, field: 'ccTips', value: 500 },
    ]);

    expect(res.periods).toEqual(new Set([P1]));
    // server 加入 employees，busser 没有 period 记录不加入
    expect([...res.employees]).toContain(`${P1}:1:Server`);
    expect([...res.employees]).not.toContain(`${P1}:2:Busser`);
    expect(res.roles).toEqual(new Set(['Server']));
  });

  it('优先角色（Host/Bartender）员工级变更会级联影响 Server/Busser', () => {
    const state = makeState({
      employees: [
        makeEmployee({ uid: '10', roleName: 'Host' }),
        makeEmployee({
          uid: '20',
          roleName: 'Server',
          byPeriod: {
            [P1]: {
              hour: 30,
              cc: 150,
              cash: 75,
              percent: 15,
            },
          },
        }),
        makeEmployee({ uid: '30', roleName: 'Busser' }),
      ],
    });

    const res = resolveDependencies(state, [
      {
        kind: 'employee',
        periodId: P1,
        uid: '10',
        roleName: 'Host',
        field: 'cc',
        value: 1,
      },
    ]);

    expect(res.periods.size).toBe(0); // 员工级，不自动把 period 放进去
    expect(res.employees).toEqual(new Set([`${P1}:10:Host`, `${P1}:20:Server`]));
    expect(res.roles).toEqual(new Set(['Host', 'Server']));
  });

  it('普通角色员工级变更只影响自己', () => {
    const state = makeState({
      employees: [
        makeEmployee({ uid: '20', roleName: 'Server' }),
        makeEmployee({ uid: '30', roleName: 'Busser' }),
      ],
    });

    const res = resolveDependencies(state, [
      { kind: 'employee', periodId: P1, uid: '20', roleName: 'Server', field: 'cc', value: 1 },
    ]);

    expect(res.employees).toEqual(new Set([`${P1}:20:Server`]));
    expect(res.roles).toEqual(new Set(['Server']));
  });

  it('period 非池子字段（如 sales）不扩散到员工集合与角色', () => {
    const state = makeState({
      employees: [
        makeEmployee({ uid: '1', roleName: 'Server' }),
        makeEmployee({ uid: '2', roleName: 'Busser' }),
      ],
    });

    const res = resolveDependencies(state, [
      { kind: 'period', periodId: P1, field: 'sales', value: 12345 },
    ]);

    expect(res.periods).toEqual(new Set([P1]));
    expect(res.employees.size).toBe(0);
    expect(res.roles.size).toBe(0);
  });

  it('period 未在修改栏，但 Server/Busser 的员工级修改只影响自己（不把 period 放入 affected）', () => {
    const state = makeState({
      employees: [
        makeEmployee({
          uid: '11',
          roleName: 'Server',
          byPeriod: {
            [P1]: { hour: 10, cc: 0, cash: 0, percent: 10 },
          },
        }),
        makeEmployee({
          uid: '22',
          roleName: 'Busser',
          byPeriod: {
            [P1]: { hour: 5, cc: 0, cash: 0, percent: 0 },
          },
        }),
      ],
    });

    const resServer = resolveDependencies(state, [
      { kind: 'employee', periodId: P1, uid: '11', roleName: 'Server', field: 'cc', value: 1 },
    ]);
    expect(resServer.periods.size).toBe(0);
    expect(resServer.employees).toEqual(new Set([`${P1}:11:Server`]));
    expect(resServer.roles).toEqual(new Set(['Server']));

    const resBusser = resolveDependencies(state, [
      { kind: 'employee', periodId: P1, uid: '22', roleName: 'Busser', field: 'cc', value: 1 },
    ]);
    expect(resBusser.periods.size).toBe(0);
    expect(resBusser.employees).toEqual(new Set([`${P1}:22:Busser`]));
    expect(resBusser.roles).toEqual(new Set(['Busser']));
  });

  it('period 未在修改栏，但 Host 的员工级修改会级联影响同列 Server/Busser（仅限有记录者），period 不加入 affected', () => {
    const state = makeState({
      employees: [
        makeEmployee({
          uid: '10',
          roleName: 'Host',
          byPeriod: { [P1]: { hour: 8, cc: 0, cash: 0, percent: 0 } },
        }),
        makeEmployee({
          uid: '20',
          roleName: 'Server',
          byPeriod: { [P1]: { hour: 30, cc: 0, cash: 0, percent: 15 } },
        }),
        // 有记录的 Busser 会被带上
        makeEmployee({
          uid: '30',
          roleName: 'Busser',
          byPeriod: { [P1]: { hour: 6, cc: 0, cash: 0, percent: 0 } },
        }),
        // 没有记录的不加入
        makeEmployee({ uid: '31', roleName: 'Busser' }),
      ],
    });

    const res = resolveDependencies(state, [
      { kind: 'employee', periodId: P1, uid: '10', roleName: 'Host', field: 'cc', value: 1 },
    ]);

    expect(res.periods.size).toBe(0);
    expect(res.employees).toEqual(new Set([`${P1}:10:Host`, `${P1}:20:Server`, `${P1}:30:Busser`]));
    expect(res.roles).toEqual(new Set(['Host', 'Server', 'Busser']));
  });
});
