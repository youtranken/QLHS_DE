import { TICKET_STATUS } from '@qlhs/contracts'

/**
 * F12 — duplicate-submission detection, evaluated at DCC1's reception gate.
 *
 * One rule, no free-text similarity: a suspected re-submit is another ticket with
 * the SAME Document Type + Contract No + Project/Team, filed within a month. Both
 * fields are HINTS — DCC1 opens the suspect to compare, then takes this one in or
 * Returns it. `document_no` is not usable here: it is minted later, at the ACC
 * step, so it is always null on the tickets this gate compares.
 */
export const DUP_TIER = { Strong: 'strong' } as const
export type DupTier = (typeof DUP_TIER)[keyof typeof DUP_TIER]

/** Beyond a month the same paper is ordinary recurring business, not a re-submit. */
const WINDOW_DAYS = 30
const MAX_HITS = 5

export interface DupSubject {
  id: string
  code: string | null
  status: string
  flow: string
  documentType: string | null
  contractNo: string | null
  projectTeam: string | null
  contractor: string | null
  amount: bigint | null
  currency: string | null
  createdAt: Date
}

export interface DupHint {
  id: string
  code: string | null
  status: string
  flow: string
  tier: DupTier
  contractor: string | null
  amount: string | null
  currency: string | null
  ageDays: number
}

/** Vietnamese is typed with and without diacritics for the same value ("HĐ" vs
 *  "hd", "Công ty" vs "cong ty"), so fold them away before any comparison. `đ`
 *  is a distinct letter, not a combining mark — NFD leaves it, hence the pair. */
function foldVi(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

/** Contract numbers are typed by hand from paper: `HĐ-2026/ABC`, `hd 2026 abc`
 *  and `HD2026ABC` are the same number, so compare on alphanumerics alone. */
function contractKey(v: string | null): string | null {
  const k = foldVi(v ?? '').replace(/[^\p{L}\p{N}]/gu, '').toUpperCase()
  return k.length > 0 ? k : null
}

/** Document Type / Project-Team come from admin dropdowns but may carry stray
 *  case/space; fold + collapse so equal values compare equal. */
function plainKey(v: string | null): string | null {
  const k = foldVi(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return k.length > 0 ? k : null
}

/** Whole days between two instants, ORDER-SYMMETRIC: abs the delta before the
 *  floor. floor-then-abs is not symmetric (−30.2d floors to −31 → 31), which
 *  would exclude a near-duplicate at the 30-day boundary depending on argument
 *  order. */
function daysBetween(from: Date, to: Date): number {
  return Math.floor(Math.abs(to.getTime() - from.getTime()) / 86_400_000)
}

/** Same Document Type + Contract No + Project/Team, filed within a month, and not
 *  a withdrawn (Cancelled) ticket. All three keys must be present on both sides —
 *  "both empty" is absence of data, not evidence. The window is measured BETWEEN
 *  the two submissions (not from `now`) so an old ticket still sitting in the Pool
 *  is never flagged against something filed months later. */
function isDuplicate(subject: DupSubject, other: DupSubject): boolean {
  if (other.status === TICKET_STATUS.Cancelled) return false
  const dt = plainKey(subject.documentType)
  const cn = contractKey(subject.contractNo)
  const pt = plainKey(subject.projectTeam)
  if (dt === null || cn === null || pt === null) return false
  if (dt !== plainKey(other.documentType)) return false
  if (cn !== contractKey(other.contractNo)) return false
  if (pt !== plainKey(other.projectTeam)) return false
  return daysBetween(other.createdAt, subject.createdAt) <= WINDOW_DAYS
}

/** Suspected duplicates of `subject` among `others`, newest match first. */
export function findDuplicates(subject: DupSubject, others: readonly DupSubject[], now: Date): DupHint[] {
  const hits: DupHint[] = []
  for (const other of others) {
    if (other.id === subject.id) continue
    if (!isDuplicate(subject, other)) continue
    hits.push({
      id: other.id,
      code: other.code,
      status: other.status,
      flow: other.flow,
      tier: DUP_TIER.Strong,
      contractor: other.contractor,
      amount: other.amount === null ? null : other.amount.toString(),
      currency: other.currency,
      ageDays: daysBetween(other.createdAt, now),
    })
  }
  hits.sort((a, b) => a.ageDays - b.ageDays)
  return hits.slice(0, MAX_HITS)
}
