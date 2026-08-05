import { Injectable } from '@nestjs/common'
import { ROLE, TICKET_STATUS, type Flow, type TicketStatus } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { overdueDays } from '../../domain/sla/overdue'
import { SlaClock, startOf } from '../sla/sla-clock'
import { makeThresholdOf } from '../../domain/admin/overview'
import { legalActionsFor, type LegalAction } from '../core/legal-actions.usecase'

export interface WorkboxCard {
  id: string
  code: string | null
  status: string
  flow: string
  priority: string
  contractor: string | null
  amount: string | null
  overdueDays: number
  actions: LegalAction[]
  /** F8 — SLA clock stopped ("chờ bổ sung"). */
  paused: boolean
}

/** DCC1's non-Pool stations (Submitted to VP Andy, Submitted to BOP) with the
 *  derived actionbar per card. Full multi-column board = story 1-9/1-10. */
@Injectable()
export class ListWorkboxUseCase {
  private static readonly STATIONS = [
    TICKET_STATUS.SubmittedToVpAndy,
    TICKET_STATUS.SubmittedToBop,
  ]

  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly clock: SystemClock,
    private readonly slaClock: SlaClock,
  ) {}

  async execute(): Promise<WorkboxCard[]> {
    const now = this.clock.now()
    const rows = await this.tickets.listByStatuses([...ListWorkboxUseCase.STATIONS])
    const paused = await this.slaClock.forRows(rows, now)
    // One threshold snapshot for the whole workbox instead of a findUnique per row.
    const thresholdOf = makeThresholdOf(await this.sla.list())
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      flow: r.flow,
      priority: r.priority,
      contractor: r.contractor,
      amount: r.amount === null ? null : r.amount.toString(),
      overdueDays: overdueDays(startOf(paused, r), thresholdOf(r.status, r.flow), now),
      paused: paused.get(r.id)?.paused ?? false,
      actions: legalActionsFor(r.status as TicketStatus, ROLE.Dcc1, r.flow as Flow),
    }))
  }
}
