/** The "unseen" signal turns on 24h after the reference moment (fixed, distinct
 *  from the configurable SLA thresholds — AD-18). Red is reserved for SLA, so the
 *  web renders this as an accent dot + bold, never red (UX-DR14). */
const UNSEEN_MS = 24 * 3600_000

/**
 * Whether a ticket is "unseen" for a viewer, DERIVED at read time (AD-6 — no stored
 * flag). The reference is the last view if any, else when the ticket arrived; the
 * signal fires once `now - reference` exceeds 24h. A never-viewed brand-new ticket
 * is therefore NOT instantly unseen — only after it has sat unseen for a day (AC4).
 */
export function isUnseen(lastViewedAt: Date | null, arrivedAt: Date, now: Date): boolean {
  const reference = lastViewedAt ?? arrivedAt
  return now.getTime() - reference.getTime() > UNSEEN_MS
}
