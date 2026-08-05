// Minimal RFC-4180 CSV helpers. buildCsv is pure (testable); downloadCsv is the
// browser side-effect. Kept generic so any table can export its current rows.

const NEEDS_QUOTE = /[",\n\r]/
// A leading =,+,-,@,TAB,CR makes Excel/Sheets evaluate the cell as a formula
// (CSV injection, CWE-1236). Contractor/contractNo/code are user-controlled.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

function cell(v: unknown): string {
  if (typeof v === 'number') return String(v) // numbers can't be formulas
  const s = v == null ? '' : String(v)
  const safe = FORMULA_TRIGGER.test(s) ? `'${s}` : s
  return NEEDS_QUOTE.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Header row + data rows → a CSV string (CRLF line breaks, quoted as needed). */
export function buildCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

/** Trigger a client-side download. Prepends a BOM so Excel reads UTF-8 (dấu tiếng Việt). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
