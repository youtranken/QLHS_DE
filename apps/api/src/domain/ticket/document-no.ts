/**
 * Document No (contract number) entered by DCC2/DCC3 before sending to Accounting
 * — distinct from the ticket `code` (CT-YYYY-NNNN minted by DCC1). Free-form text
 * (formats vary in practice), so the only rules here are non-empty and a sane
 * length ceiling — the latter keeps an oversized paste from overflowing the btree
 * unique index (Postgres 54000 → 500). The DB partial-unique index is the real
 * cross-flow duplicate guard, excluding Cancelled (M5, AD-20).
 */
export const DOCUMENT_NO_MAX = 200

export function isValidDocumentNo(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= DOCUMENT_NO_MAX
}
