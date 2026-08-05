import { Injectable } from '@nestjs/common'
import type { Priority } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { LockRepo } from '../../infra/prisma/ticket/lock.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { sortPool } from '../../domain/pool/pool-order'
import { dwellDays, overdueDays } from '../../domain/sla/overdue'
import { heldByOther } from '../../domain/lock/lock'
import type { DupHint } from '../../domain/ticket/duplicate'
import { ScanDuplicatesUseCase } from './scan-duplicates.usecase'
import { SlaClock, startOf } from '../sla/sla-clock'
import { makeThresholdOf } from '../../domain/admin/overview'

export interface PoolCard {
  id: string
  code: string | null
  flow: string
  priority: string
  documentType: string | null
  contractor: string | null
  amount: string | null
  currency: string | null
  statusEnteredAt: string
  dwellDays: number
  overdueDays: number
  lockedBy: string | null
  lockedByMe: boolean
  /** F12 — suspected duplicates for DCC1 to weigh before taking the ticket in. */
  dupOf: DupHint[]
  /** F8 — clock stopped waiting on paperwork from outside. */
  paused: boolean
}

/** DCC1 Pool inbox: sorted (priority↑, oldest-first) with derived dwell/overdue
 *  and soft-lock status — all computed at read (AD-6). */
@Injectable()
export class ListPoolUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly lock: LockRepo,
    private readonly clock: SystemClock,
    private readonly dupes: ScanDuplicatesUseCase,
    private readonly slaClock: SlaClock,
  ) {}

  async execute(viewerSub: string): Promise<PoolCard[]> {
    const now = this.clock.now()
    const rows = await this.tickets.listPool()
    const sorted = sortPool(
      rows.map((r) => ({ ...r, priority: r.priority as Priority })),
    )
    const hints = await this.dupes.forSubjects(rows)
    const clock = await this.slaClock.forRows(rows, now)
    // One threshold snapshot for the whole board instead of a findUnique per card.
    const thresholdOf = makeThresholdOf(await this.sla.list())
    return Promise.all(
      sorted.map(async (r) => {
        const threshold = thresholdOf(r.status, r.flow)
        const lk = await this.lock.get(r.id)
        const live = lk !== null && lk.expiresAt.getTime() > now.getTime()
        return {
          id: r.id,
          code: r.code,
          flow: r.flow,
          priority: r.priority,
          documentType: r.documentType,
          contractor: r.contractor,
          amount: r.amount === null ? null : r.amount.toString(),
          currency: r.currency,
          statusEnteredAt: r.statusEnteredAt.toISOString(),
          dwellDays: dwellDays(startOf(clock, r), now),
          overdueDays: overdueDays(startOf(clock, r), threshold, now),
          lockedBy: heldByOther(lk, now, viewerSub) ? (lk?.holderSub ?? null) : null,
          lockedByMe: live && lk?.holderSub === viewerSub,
          dupOf: hints.get(r.id) ?? [],
          paused: clock.get(r.id)?.paused ?? false,
        }
      }),
    )
  }
}
