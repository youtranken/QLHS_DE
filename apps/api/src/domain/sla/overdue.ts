import { businessDaysBetween } from './business-days'

/**
 * SLA/dwell are DERIVED at read time (AD-6) from `status_entered_at` (B2) and
 * the `(status, flow)` threshold — never a stored flag.
 */
export function dwellDays(statusEnteredAt: Date, now: Date): number {
  return businessDaysBetween(statusEnteredAt, now)
}

/** Days past the threshold (0 if within SLA). A null threshold = no SLA (closed). */
export function overdueDays(
  statusEnteredAt: Date,
  thresholdDays: number | null,
  now: Date,
): number {
  if (thresholdDays === null) return 0
  return Math.max(0, businessDaysBetween(statusEnteredAt, now) - thresholdDays)
}

export function isOverdue(
  statusEnteredAt: Date,
  thresholdDays: number | null,
  now: Date,
): boolean {
  return overdueDays(statusEnteredAt, thresholdDays, now) > 0
}
