/**
 * Bucket an instant into a calendar period KEY on the Vietnam civil calendar
 * (fixed regardless of the process TZ — prod runs UTC). Analytics group by these
 * keys, so a ticket completed at 23:30 ICT lands in the right day/week/month.
 */
const ZONE = 'Asia/Ho_Chi_Minh'
const DAY_MS = 86_400_000

const ymdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The civil-calendar date of `instant` as `YYYY-MM-DD`. */
export function civilYmd(instant: Date): string {
  return ymdFmt.format(instant)
}

/** Civil date as a UTC-midnight ordinal, so week arithmetic is TZ-free. */
function civilOrdinal(instant: Date): number {
  const [y, m, d] = civilYmd(instant).split('-')
  return Date.UTC(Number(y), Number(m) - 1, Number(d))
}

export type Granularity = 'week' | 'month'

/** `YYYY-MM` for month, or the ISO Monday `YYYY-MM-DD` for week. */
export function periodKey(instant: Date, granularity: Granularity): string {
  if (granularity === 'month') return civilYmd(instant).slice(0, 7)
  const ord = civilOrdinal(instant)
  // getUTCDay: Sun=0..Sat=6 → days since Monday = (day+6)%7.
  const backToMonday = (new Date(ord).getUTCDay() + 6) % 7
  return new Date(ord - backToMonday * DAY_MS).toISOString().slice(0, 10)
}
