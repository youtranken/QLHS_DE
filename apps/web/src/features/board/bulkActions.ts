import type { BoardCard, LegalAction } from './api'
import { t } from '../../i18n'

/**
 * FR-8 bulk apply on the "Submitted to VP Andy" column: a bulk action must be
 * legal for EVERY selected card, and only safe forward moves qualify — reason-
 * gated (SendBack) and pseudo/client-only (`__pick`, SLA pause) actions never
 * go bulk, so a batch can't silently skip the reason a single-card path demands.
 */
export function isBulkable(a: LegalAction): boolean {
  // `sendToAccounting` needs a DISTINCT number per ticket — it has its own batch
  // sheet (BatchSendAccountingModal), never a one-action bulk.
  return !a.reasonRequired && !a.event.startsWith('__') && a.event !== 'sendToAccounting'
}

/** A column earns a bulk-select checkbox only if some card there has a bulk-apply
 *  action — else the checkbox is dead weight (Pool "Nhận", Received-from-ACC). */
export function columnHasBulkAction(cards: BoardCard[]): boolean {
  return cards.some((c) => c.actions.some(isBulkable))
}

// The "hand to DCC" step splits by flow — Contract → DCC2, Payment → DCC3 — so a
// mixed selection has NO shared event and would otherwise lose its bulk button.
// Treat both as one family: the umbrella action below routes each card to its own
// DCC (doBatch groups by event). Synthetic event, never sent to the server as-is.
export const HANDOVER_DCC = '__handover-dcc'
const HANDOVER_EVENTS = new Set<string>(['handoverToDcc2', 'handoverToDcc3'])

/** The card's own "hand to DCC" event (DCC2 vs DCC3), or undefined if it has none. */
export function handoverEventOf(card: BoardCard): string | undefined {
  return card.actions.find((a) => HANDOVER_EVENTS.has(a.event))?.event
}

// Family key: the two handover events collapse to one so Contract + Payment unify;
// everything else keys by its own event (so General stays separate — its
// andyApprove/andyRequireBop never merge into the handover umbrella).
const bulkKey = (event: string): string => (HANDOVER_EVENTS.has(event) ? HANDOVER_DCC : event)

/** Actions legal for EVERY selected card. Handover-to-DCC collapses across flows
 *  into one "Chuyển cho DCC" umbrella; all other events must match exactly. */
export function commonBulkActions(cards: BoardCard[]): LegalAction[] {
  const [first, ...rest] = cards
  if (!first) return []
  const out: LegalAction[] = []
  const seen = new Set<string>()
  for (const a of first.actions) {
    if (!isBulkable(a)) continue
    const key = bulkKey(a.event)
    if (seen.has(key)) continue
    const everyHas = rest.every((c) =>
      c.actions.some((b) => isBulkable(b) && bulkKey(b.event) === key),
    )
    if (!everyHas) continue
    seen.add(key)
    out.push(
      key === HANDOVER_DCC
        ? { event: HANDOVER_DCC, label: t('board.bulk.handoverDcc'), toStatus: '', reversible: true, reasonRequired: false }
        : a,
    )
  }
  return out
}

/**
 * "Select all" groups for a column. The "Submitted to VP Andy" column mixes two
 * bulk families whose actions never overlap — General decisions vs the Contract/
 * Payment handover-to-DCC — so one blanket "select all" would pick a mix that has
 * no common bulk action (the bar goes empty). Split it into a per-family checkbox
 * so each selection stays actionable. Every other column is single-family → one
 * plain "select all".
 */
export function bulkSelectGroups(
  selectable: BoardCard[],
): Array<{ key: 'all' | 'general' | 'handover'; cards: BoardCard[] }> {
  const general = selectable.filter((c) => c.flow === 'General')
  const handover = selectable.filter((c) => c.flow !== 'General')
  if (general.length > 0 && handover.length > 0) {
    return [
      { key: 'general', cards: general },
      { key: 'handover', cards: handover },
    ]
  }
  return [{ key: 'all', cards: selectable }]
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
