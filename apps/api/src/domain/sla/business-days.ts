/**
 * Whole business days elapsed between two instants (weekends excluded). Holiday
 * calendar is deferred (H1) — for now only Sat/Sun are skipped. SLA age + the
 * red "overdue" badge count in these units (AD-6/B2).
 */

// Day boundaries are the Vietnam civil calendar, fixed regardless of the process
// TZ (the prod container runs UTC) — otherwise the badge shifts by a day near
// local midnight.
const SLA_ZONE = 'Asia/Ho_Chi_Minh'
const DAY_MS = 86_400_000

const civilFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SLA_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The SLA-zone calendar date of `instant`, as a UTC-midnight ordinal for arithmetic. */
function civilDay(instant: Date): number {
  const [y, m, d] = civilFmt.format(instant).split('-')
  return Date.UTC(Number(y), Number(m) - 1, Number(d))
}

/** Is this instant a working day in the SLA zone? (F11 only mails on those.) */
export function isBusinessDay(instant: Date): boolean {
  const weekday = new Date(civilDay(instant)).getUTCDay()
  return weekday !== 0 && weekday !== 6
}

/**
 * `start` moved forward by `n` working days, keeping the time of day. Weekends
 * are judged on the SLA-zone calendar, NOT on UTC weekdays — an instant late in
 * the UTC evening is already tomorrow in Vietnam, and stepping by UTC days there
 * lands on the wrong side of a weekend.
 */
export function addBusinessDays(start: Date, n: number): Date {
  if (n <= 0) return start
  let cursor = start.getTime()
  let left = n
  while (left > 0) {
    cursor += DAY_MS
    if (isBusinessDay(new Date(cursor))) left -= 1
  }
  return new Date(cursor)
}

export function businessDaysBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0
  const end = civilDay(to)
  let cursor = civilDay(from)

  let days = 0
  while (cursor < end) {
    cursor += DAY_MS
    const weekday = new Date(cursor).getUTCDay()
    if (weekday !== 0 && weekday !== 6) days += 1
  }
  return days
}
