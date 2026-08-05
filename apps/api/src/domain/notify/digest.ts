import { businessDaysBetween } from '../sla/business-days'
import { overdueDays } from '../sla/overdue'

/**
 * F11 — the morning digest. The rule that keeps it from becoming spam lives
 * here: an EMPTY digest is `null`, never an email. Silence therefore means
 * "nothing needs you", which is what makes the mail worth opening at all.
 *
 * A paused ticket (F8) is waiting on purpose and is excluded outright — nagging
 * someone about a wait they already explained is precisely the noise to avoid.
 */

/** Warn this many business days before the threshold bites. */
const DUE_SOON_DAYS = 1

export interface DigestCandidate {
  code: string | null
  flow: string
  status: string
  /** Pause-adjusted entry time (SlaClock) — never the raw column. */
  enteredAt: Date
  threshold: number | null
  paused: boolean
}

export interface DigestLine {
  code: string | null
  flow: string
  status: string
  overdueDays: number
  daysLeft: number
}

export interface Digest {
  overdue: DigestLine[]
  dueSoon: DigestLine[]
  awaiting: DigestLine[]
  total: number
}

export interface DigestInput {
  /** Tickets this person personally holds. */
  held: readonly DigestCandidate[]
  /** Tickets sitting in their role's inbox waiting to be taken/confirmed. */
  awaiting: readonly DigestCandidate[]
}

function line(c: DigestCandidate, now: Date): DigestLine {
  const elapsed = businessDaysBetween(c.enteredAt, now)
  return {
    code: c.code,
    flow: c.flow,
    status: c.status,
    overdueDays: overdueDays(c.enteredAt, c.threshold, now),
    daysLeft: c.threshold === null ? Number.POSITIVE_INFINITY : c.threshold - elapsed,
  }
}

function measurable(list: readonly DigestCandidate[], now: Date): DigestLine[] {
  return list.filter((c) => !c.paused && c.threshold !== null).map((c) => line(c, now))
}

/**
 * The shared inbox is judged more strictly than a person's own tickets: report
 * it only once its allowance is spent (due today or already late), not a day
 * ahead. A ticket you hold deserves lead time to plan around; a ticket that just
 * landed in the Pool is ordinary traffic. Without this, the seeded 1-day SLA on
 * `Submitted` makes every brand-new Pool ticket "due soon" and DCC1 gets mail
 * every single working morning — which is how a digest becomes wallpaper.
 */
function inboxNeedsAttention(t: DigestLine): boolean {
  return t.overdueDays > 0 || t.daysLeft <= 0
}

export function buildDigest(input: DigestInput, now: Date): Digest | null {
  const held = measurable(input.held, now)
  const overdue = held.filter((t) => t.overdueDays > 0).sort((a, b) => b.overdueDays - a.overdueDays)
  const dueSoon = held.filter((t) => t.overdueDays === 0 && t.daysLeft <= DUE_SOON_DAYS)
  // The shared inbox gets the SAME urgency test as tickets held personally. The
  // Pool is never empty, so listing all of it would mail DCC1 every single
  // morning — and a mail that always arrives is a mail nobody reads.
  const awaiting = measurable(input.awaiting, now).filter(inboxNeedsAttention)

  const total = overdue.length + dueSoon.length + awaiting.length
  return total === 0 ? null : { overdue, dueSoon, awaiting, total }
}
