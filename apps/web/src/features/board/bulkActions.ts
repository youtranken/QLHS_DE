import type { BoardCard, LegalAction } from './api'

/**
 * FR-8 bulk apply on the "Submitted to VP Andy" column: a bulk action must be
 * legal for EVERY selected card, and only safe forward moves qualify — reason-
 * gated (SendBack) and pseudo/client-only (`__pick`, SLA pause) actions never
 * go bulk, so a batch can't silently skip the reason a single-card path demands.
 */
export function isBulkable(a: LegalAction): boolean {
  return !a.reasonRequired && !a.event.startsWith('__')
}

/** A column earns a bulk-select checkbox only if some card there has a bulk-apply
 *  action — else the checkbox is dead weight (Pool "Nhận", Received-from-ACC). */
export function columnHasBulkAction(cards: BoardCard[]): boolean {
  return cards.some((c) => c.actions.some(isBulkable))
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
