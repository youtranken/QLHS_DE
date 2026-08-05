import { Injectable } from '@nestjs/common'
import { isTerminal, type TicketStatus } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaPauseRepo } from '../../infra/prisma/sla/sla-pause.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { TicketNotFoundError } from '../../domain/errors'
import { NotHolderError, PauseReasonRequiredError, PauseStateError } from '../../domain/sla/pause-errors'

export interface PauseRequest {
  ticketId: string
  actorSub: string
  reason: string
}

/**
 * F8 — stop the SLA clock while the ticket waits on something outside the office.
 * Guard is deliberately narrow: only the CURRENT HOLDER, because only they can
 * answer for the wait. Pausing changes no status, so this never goes near
 * transition() (AD-2) and writes no ticket_event (AD-4) — `ticket_sla_pause` is
 * its own audit record, and Admin reads it to spot a station over-using pause.
 */
@Injectable()
export class PauseSlaUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly pauses: SlaPauseRepo,
  ) {}

  async execute(req: PauseRequest): Promise<void> {
    const reason = req.reason.trim()
    if (reason.length === 0) throw new PauseReasonRequiredError('Phải nêu lý do chờ bổ sung')
    const ticket = await assertHolder(this.tickets, req.ticketId, req.actorSub)
    // A closed ticket has no clock left to stop, and no station would ever show
    // it again — the pause could never be resumed and would haunt the report.
    if (isTerminal(ticket.status as TicketStatus)) {
      throw new PauseStateError('Hồ sơ đã đóng — không còn đồng hồ SLA để dừng')
    }
    if (await this.pauses.openFor(req.ticketId)) {
      throw new PauseStateError('Hồ sơ đang ở trạng thái chờ bổ sung')
    }
    await this.pauses.pause(req.ticketId, reason, req.actorSub, ticket.status)
  }
}

/** F8 — restart the clock. The forgiven span is closed at this instant. */
@Injectable()
export class ResumeSlaUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly pauses: SlaPauseRepo,
    private readonly clock: SystemClock,
  ) {}

  async execute(req: { ticketId: string; actorSub: string }): Promise<void> {
    await assertHolder(this.tickets, req.ticketId, req.actorSub)
    // No pre-check: the UPDATE itself tells us whether a window was open, so a
    // second resume racing the first cannot report success having changed nothing.
    if (!(await this.pauses.resume(req.ticketId, req.actorSub, this.clock.now()))) {
      throw new PauseStateError('Hồ sơ không ở trạng thái chờ bổ sung')
    }
  }
}

async function assertHolder(
  tickets: TicketQueryRepo,
  ticketId: string,
  actorSub: string,
): Promise<{ status: string }> {
  const ticket = await tickets.findById(ticketId)
  if (!ticket) throw new TicketNotFoundError(ticketId)
  if (ticket.currentHolderSub !== actorSub) {
    throw new NotHolderError('Chỉ người đang giữ hồ sơ mới dừng/chạy lại đồng hồ SLA')
  }
  return ticket
}
