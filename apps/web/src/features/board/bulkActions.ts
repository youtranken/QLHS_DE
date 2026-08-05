import type { BoardCard, LegalAction } from './api'

/**
 * FR-8 bulk apply on the "Submitted to VP Andy" column: a bulk action must be
 * legal for EVERY selected card, and only safe forward moves qualify — reason-
 * gated (SendBack) and pseudo/client-only (`__pick`, SLA pause) actions never
 * go bulk, so a batch can't silently skip the reason a single-card path demands.
 */
function isBulkable(a: LegalAction): boolean {
  return !a.reasonRequired && !a.event.startsWith('__')
}

export function commonBulkActions(cards: BoardCard[]): LegalAction[] {
  const [first, ...rest] = cards
  if (!first) return []
  return first.actions.filter(
    (a) => isBulkable(a) && rest.every((c) => c.actions.some((b) => b.event === a.event)),
  )
}

export interface BatchOutcome {
  ok: number
  failed: number
}

/** Fold the per-ticket batch results into an ok/failed tally for one toast. */
export function summarizeBatch(results: { ok: boolean }[]): BatchOutcome {
  const ok = results.filter((r) => r.ok).length
  return { ok, failed: results.length - ok }
}
