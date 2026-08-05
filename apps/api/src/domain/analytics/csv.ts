/**
 * Minimal RFC-4180 CSV. Prefixed with a UTF-8 BOM so Excel opens Vietnamese text
 * in the right encoding instead of mojibake. A field is quoted only when it holds
 * a comma, quote, or newline; embedded quotes are doubled.
 */
const BOM = '﻿'

// A leading =,+,-,@,TAB,CR makes Excel/Sheets evaluate the cell as a formula
// (CSV injection, CWE-1236). Free-text columns (reason) are user-controlled.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

function escapeField(value: string | number): string {
  // Numbers can't be formulas; keep them intact so a negative stays numeric.
  if (typeof value === 'number') return String(value)
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const line = (cells: readonly (string | number)[]) => cells.map(escapeField).join(',')
  return BOM + [line(headers), ...rows.map(line)].join('\r\n') + '\r\n'
}
