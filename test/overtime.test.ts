import { describe, it, expect } from 'vitest';
import { computeWeeklyOvertimeByRole } from '../src';
import { ShiftRecord } from '../src';

describe('computeWeeklyOvertimeByRole', () => {
  it('按 clockIn 排序并在 40h 阈值处切分到各自 role 的 regular/overtime', () => {
    const recs: ShiftRecord[] = [
      // 故意打乱顺序：Busser 先 15h（晚的时间）
      { clockIn: '2025-06-03T10:00:00Z', roleId: 'Busser', hour: 15 },
      // Server 30h（早的时间）
      { clockIn: '2025-06-01T10:00:00Z', roleId: 'Server', hour: 30 },
      // Line Cook 10h（最晚）
      { clockIn: '2025-06-04T10:00:00Z', roleId: 'Line Cook', hour: 10 },
    ];

    // 排序后扫描：累计到 40h 为止计 regular，其后计 overtime
    // 顺序应为：Server 30 -> Busser 15（此处只剩 10 regular + 5 overtime）-> Line Cook 10（全 overtime）
    const res = computeWeeklyOvertimeByRole(recs);

    expect(res).toEqual({
      Server: { regularHours: 30, overtimeHours: 0 },
      Busser: { regularHours: 10, overtimeHours: 5 },
      'Line Cook': { regularHours: 0, overtimeHours: 10 },
    });
  });

  it('恰好等于 40h 时不应产生 overtime', () => {
    const recs: ShiftRecord[] = [
      { clockIn: '2025-06-01T08:00:00Z', roleId: 'Server', hour: 25 },
      { clockIn: '2025-06-02T08:00:00Z', roleId: 'Busser', hour: 15 },
    ];
    const res = computeWeeklyOvertimeByRole(recs);

    expect(res).toEqual({
      Server: { regularHours: 25, overtimeHours: 0 },
      Busser: { regularHours: 15, overtimeHours: 0 },
    });
  });

  it('保留两位小数并正确进位/舍入', () => {
    const recs: ShiftRecord[] = [
      // 这两段合计 1.234 + 0.006 = 1.24（四舍五入到两位）
      { clockIn: '2025-06-01T08:00:00Z', roleId: 'Server', hour: 1.234 },
      { clockIn: '2025-06-01T09:00:00Z', roleId: 'Server', hour: 0.006 },
    ];
    const res = computeWeeklyOvertimeByRole(recs);

    expect(res).toEqual({
      Server: { regularHours: 1.24, overtimeHours: 0 },
    });
  });

  it('支持自定义 weeklyCap（例如 30h：超过部分进入 overtime）', () => {
    const recs: ShiftRecord[] = [
      { clockIn: '2025-06-01T08:00:00Z', roleId: 'Server', hour: 20 },
      { clockIn: '2025-06-02T08:00:00Z', roleId: 'Server', hour: 15 },
    ];
    const res = computeWeeklyOvertimeByRole(recs, 30);

    // 先 20 regular，再来 15：其中 10 进 regular，5 进 overtime
    expect(res).toEqual({
      Server: { regularHours: 30, overtimeHours: 5 },
    });
  });

  it('对异常值友好：负数小时按 0 处理；空输入返回空对象', () => {
    const resEmpty = computeWeeklyOvertimeByRole([]);
    expect(resEmpty).toEqual({});

    const resNeg = computeWeeklyOvertimeByRole([
      { clockIn: '2025-06-01T08:00:00Z', roleId: 'Server', hour: -5 },
      { clockIn: '2025-06-01T09:00:00Z', roleId: 'Server', hour: 5 },
    ]);

    expect(resNeg).toEqual({
      Server: { regularHours: 5, overtimeHours: 0 },
    });
  });

  it('weeklyCap 为 0 时，全部都应该记为 overtime', () => {
    const recs: ShiftRecord[] = [
      { clockIn: '2025-06-01T08:00:00Z', roleId: 'Server', hour: 3 },
      { clockIn: '2025-06-01T09:00:00Z', roleId: 'Busser', hour: 2.5 },
    ];
    const res = computeWeeklyOvertimeByRole(recs, 0);

    expect(res).toEqual({
      Server: { regularHours: 0, overtimeHours: 3 },
      Busser: { regularHours: 0, overtimeHours: 2.5 },
    });
  });
});
