import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { TICKET_EVENT, type Flow, type TicketStatus } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import { TicketNotFoundError } from '../../../domain/errors'
import {
  transition,
  ForbiddenTransitionError,
  type Actor,
  type TicketState,
} from '../../../domain/ticket/transition'
import { prefixForFlow, formatCode } from '../../../domain/numbering/numbering'
import { heldByOther } from '../../../domain/lock/lock'

interface TicketRow {
  id: string
  status: string
  flow: string
  applicant_sub: string
  current_holder_sub: string | null
  round_no: number
  status_entered_at: Date
  code: string | null
}

/**
 * Confirm-flow (AD-2/AD-5/AD-14): one transaction that locks the ticket row,
 * mints its code (only if NULL — immutable across rounds) from the row-locked
 * `(prefix,year)` counter, then runs the Submitted → Submitted to VP Andy
 * transition. Rollback un-does the counter increment (no skipped numbers).
 */
@Injectable()
export class ConfirmFlowRepo {
  constructor(private readonly prisma: PrismaService) {}

  async confirm(
    ticketId: string,
    actor: Actor,
    now: Date,
  ): Promise<{ code: string; status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<TicketRow[]>`
        SELECT id, status, flow, applicant_sub, current_holder_sub, round_no, status_entered_at, code
        FROM ticket WHERE id = ${ticketId} FOR UPDATE`
      const row = rows[0]
      if (!row) throw new TicketNotFoundError(ticketId)

      const lock = await tx.ticketLock.findUnique({ where: { ticketId } })
      if (
        lock &&
        heldByOther(
          {
            ticketId,
            holderSub: lock.holderSub,
            acquiredAt: lock.acquiredAt,
            expiresAt: lock.expiresAt,
          },
          now,
          actor.sub,
        )
      ) {
        throw new ForbiddenTransitionError(`Hồ sơ đang được ${lock.holderSub} xử lý`)
      }

      const state: TicketState = {
        id: row.id,
        status: row.status as TicketStatus,
        flow: row.flow as Flow,
        applicantSub: row.applicant_sub,
        currentHolderSub: row.current_holder_sub,
        roundNo: row.round_no,
        statusEnteredAt: row.status_entered_at,
      }

      let code = row.code
      if (code === null) {
        const prefix = prefixForFlow(state.flow)
        const seq = await mintSeq(tx, prefix, now.getFullYear())
        code = formatCode(prefix, now.getFullYear(), seq)
      }

      const out = transition(state, { event: TICKET_EVENT.SubmitToAndy, actor, now })
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          code,
          status: out.ticket.status,
          currentHolderSub: out.ticket.currentHolderSub,
          roundNo: out.ticket.roundNo,
          statusEnteredAt: out.ticket.statusEnteredAt,
        },
      })
      await tx.ticketEvent.create({
        data: {
          ticketId,
          actorSub: out.event.actorSub,
          action: out.event.action,
          fromStatus: out.event.fromStatus,
          toStatus: out.event.toStatus,
          roundNo: out.event.roundNo,
          occurredAt: out.event.occurredAt,
        },
      })
      // Left the Pool → release the soft lock.
      await tx.ticketLock.deleteMany({ where: { ticketId } })
      return { code, status: out.ticket.status }
    })
  }
}

/** Atomic next sequence for `(prefix,year)`; rolls back with the transaction. */
async function mintSeq(tx: Prisma.TransactionClient, prefix: string, year: number): Promise<number> {
  const key = `${prefix}-${year}`
  const rows = await tx.$queryRaw<Array<{ next_seq: number }>>`
    INSERT INTO number_counter (prefix_year, next_seq) VALUES (${key}, 2)
    ON CONFLICT (prefix_year) DO UPDATE SET next_seq = number_counter.next_seq + 1
    RETURNING next_seq`
  return rows[0]!.next_seq - 1
}
