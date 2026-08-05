import type { PauseEntry, TimelineEntry } from './api'

export type LogRow =
  | { kind: 'event'; at: string; entry: TimelineEntry }
  | { kind: 'pause'; at: string; pause: PauseEntry }
  | { kind: 'resume'; at: string; pause: PauseEntry }

/**
 * The handover log with the SLA pauses woven in, newest first.
 *
 * Pauses are NOT ticket_event rows — that log has a single writer and no status
 * changed when the clock stopped (AD-4) — so they are merged here at read time.
 * Without this, anyone reviewing a ticket sees it sit still for four days with
 * no explanation anywhere on the page.
 */
export function mergeLog(
  timeline: readonly TimelineEntry[],
  pauses: readonly PauseEntry[],
): LogRow[] {
  const rows: LogRow[] = timeline.map((entry) => ({ kind: 'event', at: entry.occurredAt, entry }))
  for (const pause of pauses) {
    rows.push({ kind: 'pause', at: pause.pausedAt, pause })
    if (pause.resumedAt !== null) rows.push({ kind: 'resume', at: pause.resumedAt, pause })
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at))
}
