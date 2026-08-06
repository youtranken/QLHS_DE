import type { BoardCard } from './api'

export interface BoardFilter {
  q: string
  overOnly: boolean
  /** 'All' or a canonical flow (Contract/Payment/General). */
  flow: string
  /** 'All' or a priority value — the picker offers 'rush' (Gấp) / 'normal' (Thường).
   *  Legacy 'urgent' tickets are treated as 'rush' so the Gấp filter still finds them. */
  priority: string
}

/** "Khẩn" (urgent) is retired → fold it into "Gấp" (rush) for display + filtering. */
const normPriority = (p: string): string => (p === 'urgent' ? 'rush' : p)

export const EMPTY_FILTER: BoardFilter = { q: '', overOnly: false, flow: 'All', priority: 'All' }

/** True when a card passes every active facet. Pure — the board renders from it,
 *  the spec locks its edges. */
export function cardMatches(c: BoardCard, f: BoardFilter): boolean {
  if (f.overOnly && c.overdueDays <= 0) return false
  if (f.flow !== 'All' && c.flow !== f.flow) return false
  if (f.priority !== 'All' && normPriority(c.priority) !== f.priority) return false
  const q = f.q.trim().toLowerCase()
  if (!q) return true
  return (c.code ?? '').toLowerCase().includes(q) || (c.contractor ?? '').toLowerCase().includes(q)
}
