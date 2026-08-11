import { Injectable } from '@nestjs/common'
import { TICKET_EVENT, type Flow, type TicketStatus } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import { ReconcileStateError } from '../../../application/core/ticket-errors'
import { TicketNotFoundError } from '../../../domain/errors'
import { writeEmailIntent } from '../notify/outbox.writer'
import { transition, type Actor, type TicketState } from '../../../domain/ticket/transition'

interface TicketRow {
  id: string
  status: string
  flow: string
  applicant_sub: string
  current_holder_sub: string | null
  round_no: number
  status_entered_at: Date
  reconcile_flag: boolean
}

/**
 * Close a Contract at the Hardcopy step (AD-2/AD-15): one transaction locks the
 * ticket, runs `Hardcopy → Completed`, writes the scan path, AND records the
 * Applicant email intent in the notification outbox — same round, same tx. The
 * dispatcher (Story 5.2) sends it; the unique (ticket, round, kind) index + an
 * ON CONFLICT DO NOTHING insert make a re-run idempotent.
 */
@Injectable()
export class CompleteContractRepo {
  constructor(private readonly prisma: PrismaService) {}

  async complete(
    ticketId: string,
    actor: Actor,
    now: Date,
  ): Promise<{ status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<TicketRow[]>`
        SELECT id, status, flow, applicant_sub, current_holder_sub, round_no,
               status_entered_at, reconcile_flag
        FROM ticket WHERE id = ${ticketId} FOR UPDATE`
      const row = rows[0]
      if (!row) throw new TicketNotFoundError(ticketId)
      // Locked out while DCC2 has pushed back for Return (AC4, code-review #1).
      if (row.reconcile_flag) {
        throw new ReconcileStateError('Hồ sơ đang chờ DCC1 trả lại — không thể hoàn tất')
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
      const out = transition(state, { event: TICKET_EVENT.CompleteContract, actor, now })
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
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
      // Email intent via the one AD-15 matrix (Completed emails; idempotent).
      await writeEmailIntent(tx, {
        ticketId,
        toStatus: out.ticket.status,
        roundNo: out.ticket.roundNo,
        recipientSub: row.applicant_sub,
      })
      return { status: out.ticket.status }
    })
  }
}
