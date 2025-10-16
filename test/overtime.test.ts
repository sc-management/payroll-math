import { describe, it, expect } from 'vitest';
import { computeWeeklyOvertime, ShiftRecord } from '../src';

describe('computeWeeklyOvertime', () => {
  it('counts all hours as regular when total hours are under 40', () => {
    const records: ShiftRecord[] = [
      { date: '2025-01-01', hour: 20, payRate: 10, payType: 1, position: 1 },
      { date: '2025-01-02', hour: 15, payRate: 10, payType: 1, position: 1 },
    ];
    const res = computeWeeklyOvertime(records);
    expect(res.regularHours).toBe(35);
    expect(res.overtimeHours).toBe(0);
    expect(res.fohHours).toBe(35);
    expect(res.bohHours).toBe(0);
    expect(res.fohOvertimeHours).toBe(0);
    expect(res.bohOvertimeHours).toBe(0);
    // Pay = 35 hours × $10
    expect(res.hourPay).toBe(350);
  });

  it('splits hours correctly between regular and overtime across multiple positions', () => {
    const records: ShiftRecord[] = [
      { date: '2025-01-01', hour: 30, payRate: 10, payType: 1, position: 1 },
      { date: '2025-01-02', hour: 15, payRate: 10, payType: 1, position: 2 },
    ];
    const res = computeWeeklyOvertime(records);
    // 30 FOH hours go to regular; remaining regular cap = 10; 5 hours overtime (BOH)
    expect(res.regularHours).toBe(40);
    expect(res.overtimeHours).toBe(5);
    // FOH hours = 30; FOH overtime = 0
    expect(res.fohHours).toBe(30);
    expect(res.fohOvertimeHours).toBe(0);
    // BOH hours = 15; BOH overtime = 5
    expect(res.bohHours).toBe(15);
    expect(res.bohOvertimeHours).toBe(5);
    // Pay = 30×$10 + 10×$10 + 5×$15 = $475
    expect(res.hourPay).toBe(475);
  });

  it('handles salary and hourly shifts together', () => {
    const records: ShiftRecord[] = [
      { date: '2025-01-01', hour: 40, payRate: 500, payType: 2, position: 1 },
      { date: '2025-01-02', hour: 10, payRate: 20, payType: 1, position: 1 },
    ];
    const res = computeWeeklyOvertime(records);
    // Salary hours all count as regular
    expect(res.regularHours).toBe(40);
    // Entire hourly shift is overtime since regular cap is reached
    expect(res.overtimeHours).toBe(10);
    // FOH hours = 50; FOH overtime = 10
    expect(res.fohHours).toBe(50);
    expect(res.fohOvertimeHours).toBe(10);
    // Pay = salary 500 + overtime 10×1.5×20 = 300 ⇒ total 800
    expect(res.hourPay).toBe(800);
    // No BOH hours in this scenario
    expect(res.bohHours).toBe(0);
    expect(res.bohOvertimeHours).toBe(0);
  });
});
