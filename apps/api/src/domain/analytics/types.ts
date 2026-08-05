/** One immutable audit row, projected to just what analytics reads (AD-6 — all
 *  derived at read from `ticket_event`, no new tables). */
export interface AnalyticsEvent {
  ticketId: string
  flow: string
  action: string
  fromStatus: string
  toStatus: string
  occurredAt: Date
}

export const DAY_MS = 86_400_000

/** Whole-day figure to one decimal (dwell/analytics reporting only). */
export function toDays(ms: number): number {
  return Math.round((ms / DAY_MS) * 10) / 10
}
