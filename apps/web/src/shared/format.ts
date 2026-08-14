/** Group an integer-string amount by thousands. VND uses the VN dot convention
 *  (3480500000 → "3.480.500.000"); USD uses the international comma
 *  (12750000 → "12,750,000"). Leaves non-numeric input untouched. Data stays a
 *  string end-to-end (no float rounding). */
export function groupAmount(amount: string | null | undefined, currency = 'VND'): string {
  if (!amount) return ''
  if (!/^\d+$/.test(amount)) return amount
  const sep = currency === 'USD' ? ',' : '.'
  return amount.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
}

/** Applicant amount INPUT (create/edit form) groups with commas regardless of
 *  currency — matches the field label's "100,000" convention. Distinct from
 *  groupAmount's per-currency display used on boards/detail/lists. */
export function groupAmountComma(amount: string | null | undefined): string {
  if (!amount) return ''
  if (!/^\d+$/.test(amount)) return amount
  return amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Never surface a raw PMH sub: prefer the directory name, else the email
 *  local-part, else a short id (AD-12 display-only resolution). Input is a sub. */
export function displaySub(sub: string, directory: Record<string, string> = {}): string {
  const resolved = directory[sub]
  if (resolved) return resolved.includes('@') ? (resolved.split('@')[0] ?? resolved) : resolved
  return sub.includes('@') ? (sub.split('@')[0] ?? sub) : sub.slice(0, 8)
}

/** Prettify an already-chosen display value (email → local-part; UUID sub →
 *  short id; a real name is left intact — no truncation). */
export function prettyName(value: string): string {
  if (value.includes('@')) return value.split('@')[0] ?? value
  return /^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(value) ? value.slice(0, 8) : value
}
