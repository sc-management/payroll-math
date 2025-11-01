import { EmployeeCalcInput, EmployeeCalcResult } from './types';
import { clamp01, roundToDollars } from '../state/number';
import { max0 } from './math';

export function calculateEmployee({
  roleName,
  cc,
  cash,
  percent,
  ccPoolAfterOthers,
  cashPoolAfterOthers,
  busserPercent,
}: EmployeeCalcInput): EmployeeCalcResult {
  let tipsCc = 0,
    tipsCash = 0;

  const normalizedCcPoolAfterOthers = max0(ccPoolAfterOthers);
  const normalizedCashPoolAfterOthers = max0(cashPoolAfterOthers);
  const normalizedPercent = clamp01(percent);
  const normalizedBusserPercent = clamp01(busserPercent);

  if (roleName === 'Busser') {
    tipsCc = normalizedCcPoolAfterOthers * normalizedBusserPercent * normalizedPercent;
    tipsCash = normalizedCashPoolAfterOthers * normalizedBusserPercent * normalizedPercent;
  } else if (roleName === 'Server') {
    const serverShare = 1 - normalizedBusserPercent;
    tipsCc = normalizedCcPoolAfterOthers * serverShare * normalizedPercent;
    tipsCash = normalizedCashPoolAfterOthers * serverShare * normalizedPercent;
  } else {
    // Bartender, Host, etc.
    tipsCc = cc;
    tipsCash = cash;
  }

  return { tipsCc: roundToDollars(tipsCc), tipsCash: roundToDollars(tipsCash) };
}
