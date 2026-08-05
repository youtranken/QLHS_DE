import { Injectable } from '@nestjs/common'
import { ROLE, TICKET_STATUS, type Role } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { buildDigest, type Digest, type DigestCandidate } from '../../domain/notify/digest'
import { makeThresholdOf } from '../../domain/admin/overview'
import { SlaClock } from '../sla/sla-clock'

/**
 * Statuses that sit in a role's shared inbox waiting for that role to act —
 * distinct from tickets a person personally holds. These are exactly the
 * two-phase handover waiting states (AD-10), where `current_holder_sub` is
 * deliberately null until the receiver confirms.
 */
export function awaitingStatusesFor(role: Role): string[] {
  if (role === ROLE.Dcc1) return [TICKET_STATUS.Submitted]
  // DCC2 has TWO waiting inboxes: the ordinary handover and the hardcopy one at
  // the end of the Contract flow. Missing the second let a hardcopy handover
  // blow its SLA without appearing in anyone's digest.
  if (role === ROLE.Dcc2) return [TICKET_STATUS.SubmittedToDcc2, TICKET_STATUS.SubmittedToDcc2Hardcopy]
  if (role === ROLE.Dcc3) return [TICKET_STATUS.SubmittedToDcc3]
  return []
}

/** F11 — assembles one person's morning digest, or null when nothing needs them. */
@Injectable()
export class BuildDigestUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly slaClock: SlaClock,
  ) {}

  async execute(sub: string, roles: readonly Role[], now: Date): Promise<Digest | null> {
    const awaitingStatuses = [...new Set(roles.flatMap(awaitingStatusesFor))]
    const [heldRows, awaitingRows] = await Promise.all([
      this.tickets.listHeldBy(sub),
      awaitingStatuses.length > 0 ? this.tickets.listByStatuses(awaitingStatuses) : Promise.resolve([]),
    ])
    // One threshold snapshot for the whole digest. Asking per ticket meant two
    // queries each, for every recipient, twice a day — a 200-ticket Pool alone
    // was thousands of round-trips at 07h30.
    const [clock, thresholdOf] = await Promise.all([
      this.slaClock.forRows([...heldRows, ...awaitingRows], now),
      this.sla.list().then(makeThresholdOf),
    ])

    const toCandidate = (r: (typeof heldRows)[number]): DigestCandidate => ({
      code: r.code,
      flow: r.flow,
      status: r.status,
      enteredAt: clock.get(r.id)?.enteredAt ?? r.statusEnteredAt,
      threshold: thresholdOf(r.status, r.flow),
      paused: clock.get(r.id)?.paused ?? false,
    })

    return buildDigest({ held: heldRows.map(toCandidate), awaiting: awaitingRows.map(toCandidate) }, now)
  }
}
