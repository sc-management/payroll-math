# @shaking-crab/payroll-math

A lightweight, **TypeScript-based payroll calculation library** designed for restaurant and hospitality use cases.  
It provides a set of pure utility functions to calculate **wages, tips, overtime, and compliance adjustments** with clear and predictable logic.  
All functions are side-effect free and can be used both in frontend and backend environments.

## 🚀 Features

- **Pure TypeScript** with no runtime dependencies  
- **Role-based tip allocation** (Server, Busser, Bartender, etc.)  
- **Weekly overtime calculation** following standard 40-hour rules  
- **Spread of Hours** computation for states like New York  
- **Minimum wage adjustment** and compliance support  
- **Accurate rounding logic** aligned with UI rounding behavior  
- Fully tested with [Vitest](https://vitest.dev)

## 📦 Installation

```bash
npm install @shaking-crab/payroll-math
# or
yarn add @shaking-crab/payroll-math
```

## 🧮 Quick Start

```ts
import {
  calculatePeriodTotals,
  calculateEmployee,
  sumPayrollTotals,
  computeWeeklyOvertime,
  computeSpreadOfHours,
  applyMinimumPayAdjustment,
} from '@shaking-crab/payroll-math';

const period = calculatePeriodTotals({
  sales: 1000,
  ccTips: 500,
  sc: 100,
});
console.log(period); // { totalTips: 600, tipsPercent: 0.6 }

const overtime = computeWeeklyOvertime([
  { date: '2025-10-06', hour: 42, payRate: 15, payType: 1, position: 1 },
]);
console.log(overtime.overtimeHours); // 2
```

## 🧩 API Overview

### `calculatePeriodTotals(input)`
Calculates total credit-card tips + service charges for a single payroll period.

| Parameter | Type | Description |
|------------|------|--------------|
| `sales` | `number` | Total sales for the period |
| `ccTips` | `number` | Credit card tips |
| `sc` | `number` | Service charge |

Returns `{ totalTips, tipsPercent }`.

### `calculateEmployee(input)`
Computes tips and total pay for an individual employee, considering role type, percentage, and other roles’ shares.

### `sumPayrollTotals(periods)`
Aggregates total credit and cash tips from multiple periods with rounding.

### `computeWeeklyOvertime(records)`
Splits hours into **regular** and **overtime** portions across multiple days (40-hour threshold).  
Handles **hourly (payType=1)** and **salary (payType=2)** workers.

### `computeSpreadOfHours(input)`
Implements New York's “Spread of Hours” rule.  
Adds 1 hour of pay for each workday longer than a threshold (default: 10h).

### `applyMinimumPayAdjustment(input)`
Ensures pay meets minimum wage by adjusting cash tips or bonus pay as needed.

## 🧪 Testing

```bash
npm run test
# or
yarn test
```

## 🧱 Project Structure

```
src/
├── calcEmployee.ts
├── calcPayroll.ts
├── calcPeriod.ts
├── minimumPay.ts
├── overtime.ts
├── spread.ts
├── math.ts
└── types.ts
```

## 🧾 License

MIT © Shaking Crab LLC