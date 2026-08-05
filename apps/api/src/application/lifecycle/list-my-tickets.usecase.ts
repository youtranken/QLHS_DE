import { Injectable } from '@nestjs/common'
import { isUnseen } from '../../domain/view/unseen'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { TicketViewRepo } from '../../infra/prisma/ticket/ticket-view.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { toTicketView, type TicketView } from '../core/ticket-view'

/**
 * The Applicant's own tickets, each carrying the derived "unseen >24h" flag
 * (AD-18/AD-6). Reference for a never-viewed row is `status_entered_at` — when it
 * last moved into the applicant's view — so a brand-new row isn't instantly flagged.
 */
@Injectable()
export class ListMyTicketsUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly views: TicketViewRepo,
    private readonly clock: SystemClock,
  ) {}

  async execute(applicantSub: string): Promise<TicketView[]> {
    const rows = await this.tickets.listByApplicant(applicantSub)
    const viewed = await this.views.lastViewedMap(
      rows.map((r) => r.id),
      applicantSub,
    )
    const now = this.clock.now()
    return rows.map((t) => ({
      ...toTicketView(t),
      unseen: isUnseen(viewed.get(t.id) ?? null, t.statusEnteredAt, now),
    }))
  }
}
