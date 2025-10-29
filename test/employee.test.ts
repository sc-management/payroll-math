import { describe, it, expect } from 'vitest';
import { calculateEmployee, EmployeeCalcInput, EmployeeCalcResult } from '../src';

describe('calculateEmployee (pure)', () => {
  const basePools = {
    ccPoolAfterOthers: 18_000, // 分配前剩余的 CC 小费池
    cashPoolAfterOthers: 4_000, // 分配前剩余的 Cash 小费池
    busserPercent: 0.1, // 10% 分给 Busser
  };

  it('Busser：从池子按 busserPercent × percent 分配', () => {
    const input: EmployeeCalcInput = {
      roleName: 'Busser',
      cc: 0,
      cash: 0,
      percent: 0.5, // 该 Busser 占 Busser 池的 50%
      ...basePools,
    };
    const result = calculateEmployee(input);
    expect(result).toEqual<EmployeeCalcResult>({
      tipsCc: 18_000 * 0.1 * 0.5,
      tipsCash: 4_000 * 0.1 * 0.5,
    });
  });

  it('Server：从池子按 (1 - busserPercent) × percent 分配', () => {
    const input: EmployeeCalcInput = {
      roleName: 'Server',
      cc: 0,
      cash: 0,
      percent: 0.5, // 该 Server 占 Server 池的 50%
      ...basePools,
    };
    const serverShare = 1 - basePools.busserPercent;
    const result = calculateEmployee(input);
    expect(result).toEqual<EmployeeCalcResult>({
      tipsCc: 18_000 * serverShare * 0.5,
      tipsCash: 4_000 * serverShare * 0.5,
    });
  });

  it('Other roles（Bartender/Host...）：直接返回 cc/cash（与池无关）', () => {
    const input: EmployeeCalcInput = {
      roleName: 'Bartender',
      cc: 1234,
      cash: 567,
      percent: 0.9, // 不起作用
      ...basePools,
    };
    const result = calculateEmployee(input);
    expect(result).toEqual<EmployeeCalcResult>({
      tipsCc: 1234,
      tipsCash: 567,
    });
  });

  it('池为负数时归零（max0）', () => {
    const input: EmployeeCalcInput = {
      roleName: 'Busser',
      cc: 0,
      cash: 0,
      percent: 1,
      ccPoolAfterOthers: -100, // 负数
      cashPoolAfterOthers: -50, // 负数
      busserPercent: 0.2,
    };
    const result = calculateEmployee(input);
    expect(result).toEqual<EmployeeCalcResult>({ tipsCc: 0, tipsCash: 0 });
  });

  it('percent 与 busserPercent 都会被 clamp 到 [0,1]', () => {
    const inputBusser: EmployeeCalcInput = {
      roleName: 'Busser',
      cc: 0,
      cash: 0,
      percent: 1.5, // clamp → 1
      ccPoolAfterOthers: 1000,
      cashPoolAfterOthers: 1000,
      busserPercent: -0.3, // clamp → 0
    };
    // busserPercent → 0，Busser 池为 0，所以结果应为 0
    expect(calculateEmployee(inputBusser)).toEqual({ tipsCc: 0, tipsCash: 0 });

    const inputServer: EmployeeCalcInput = {
      roleName: 'Server',
      cc: 0,
      cash: 0,
      percent: -0.2, // clamp → 0
      ccPoolAfterOthers: 1000,
      cashPoolAfterOthers: 1000,
      busserPercent: 2, // clamp → 1
    };
    // percent → 0，所以结果应为 0
    expect(calculateEmployee(inputServer)).toEqual({ tipsCc: 0, tipsCash: 0 });
  });

  it('边界：percent 为 0 时总是 0；busserPercent 为 0 时 Server 独享', () => {
    const zeroPercent: EmployeeCalcInput = {
      roleName: 'Server',
      cc: 0,
      cash: 0,
      percent: 0,
      ...basePools,
    };
    expect(calculateEmployee(zeroPercent)).toEqual({ tipsCc: 0, tipsCash: 0 });

    const serverOnly: EmployeeCalcInput = {
      roleName: 'Server',
      cc: 0,
      cash: 0,
      percent: 0.25,
      ccPoolAfterOthers: 8000,
      cashPoolAfterOthers: 2000,
      busserPercent: 0, // 全部给 Server
    };
    expect(calculateEmployee(serverOnly)).toEqual({
      tipsCc: 8000 * 1 * 0.25,
      tipsCash: 2000 * 1 * 0.25,
    });
  });

  it('边界：busserPercent 为 1 时 Busser 独享（Server 没份）', () => {
    const busserOnlyBusser: EmployeeCalcInput = {
      roleName: 'Busser',
      cc: 0,
      cash: 0,
      percent: 0.4,
      ccPoolAfterOthers: 9000,
      cashPoolAfterOthers: 3000,
      busserPercent: 1,
    };
    expect(calculateEmployee(busserOnlyBusser)).toEqual({
      tipsCc: 9000 * 1 * 0.4,
      tipsCash: 3000 * 1 * 0.4,
    });

    const busserOnlyServer: EmployeeCalcInput = {
      roleName: 'Server',
      cc: 0,
      cash: 0,
      percent: 0.4,
      ccPoolAfterOthers: 9000,
      cashPoolAfterOthers: 3000,
      busserPercent: 1,
    };
    expect(calculateEmployee(busserOnlyServer)).toEqual({ tipsCc: 0, tipsCash: 0 });
  });
});
