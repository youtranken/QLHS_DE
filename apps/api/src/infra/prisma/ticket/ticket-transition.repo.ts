import { Injectable } from '@nestjs/common'
import type { Flow, TicketStatus } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import { writeEmailIntent } from '../notify/outbox.writer'
import { TicketNotFoundError } from '../../../domain/errors'
import type { TicketState, TransitionOutput } from '../../../domain/ticket/transition'

interface TicketRow {
  id: string
  status: string
  flow: string
  applicant_sub: string
  current_holder_sub: string | null
  round_no: number
  status_entered_at: Date
}

/**
 * Runs a transition atomically (AD-2/AD-14): one transaction opened with
 * SELECT … FOR UPDATE, the domain `compute` derives the next state + audit row,
 * then status + holder + round + status_entered_at are persisted AND the single
 * TicketEvent is appended — in the same transaction. Any failure rolls back the
 * whole thing, so a status change can never exist without its audit row.
 */
@Injectable()
export class TicketTransitionRepo {
  constructor(private readonly prisma: PrismaService) {}

  apply(
    ticketId: string,
    compute: (state: TicketState) => TransitionOutput,
  ): Promise<TicketState> {
    return this.applyChain(ticketId, [compute])
  }

  /**
   * Runs one or more transitions as a SINGLE atomic step (AD-2/AD-14) — the row
   * is locked once, each compute derives the next state + audit row from the
   * previous result, and every status change + its TicketEvent commit together.
   * Used by Reopen (reopen → sendBack). Any failure rolls back the whole chain.
   */
  async applyChain(
    ticketId: string,
    computes: Array<(state: TicketState) => TransitionOutput>,
  ): Promise<TicketState> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<TicketRow[]>`
        SELECT id, status, flow, applicant_sub, current_holder_sub, round_no, status_entered_at
        FROM ticket WHERE id = ${ticketId} FOR UPDATE`
      const row = rows[0]
      if (!row) throw new TicketNotFoundError(ticketId)

      let state = rowToState(row)
      for (const compute of computes) {
        const { ticket, event } = compute(state)
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            status: ticket.status,
            currentHolderSub: ticket.currentHolderSub,
            roundNo: ticket.roundNo,
            statusEnteredAt: ticket.statusEnteredAt,
          },
        })
        await tx.ticketEvent.create({
          data: {
            ticketId: event.ticketId,
            actorSub: event.actorSub,
            action: event.action,
            fromStatus: event.fromStatus,
            toStatus: event.toStatus,
            reason: event.reason ?? null,
            roundNo: event.roundNo,
            occurredAt: event.occurredAt,
            meta: event.meta === undefined ? undefined : (event.meta as object),
          },
        })
        // Same-transaction email intent (AD-15) — Completed / Returned queue an
        // email to the Applicant; everything else is a no-op via the matrix.
        await writeEmailIntent(tx, {
          ticketId,
          toStatus: ticket.status,
          roundNo: ticket.roundNo,
          recipientSub: ticket.applicantSub,
        })
        state = ticket
      }
      return state
    })
  }
}

function rowToState(row: TicketRow): TicketState {
  return {
    id: row.id,
    status: row.status as TicketStatus,
    flow: row.flow as Flow,
    applicantSub: row.applicant_sub,
    currentHolderSub: row.current_holder_sub,
    roundNo: row.round_no,
    statusEnteredAt: row.status_entered_at,
  }
}
