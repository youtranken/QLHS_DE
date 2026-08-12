import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { FLOW, TICKET_EVENT, type Flow, type TicketStatus } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import { DocumentNoDuplicateError, ReconcileStateError } from '../../../application/core/ticket-errors'
import { TicketNotFoundError } from '../../../domain/errors'
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
 * DCC2 send-to-Accounting (AD-2/AD-14/AD-20): one transaction locks the ticket,
 * runs the `Received by DCC2 → Submitted to Accounting` transition, and writes the
 * Document No — the DB partial-unique index is the final TOCTOU guard, so a
 * concurrent duplicate surfaces as P2002 → DocumentNoDuplicateError.
 */
@Injectable()
export class AccountingRepo {
  constructor(private readonly prisma: PrismaService) {}

  async submitToAccounting(
    ticketId: string,
    actor: Actor,
    documentNo: string,
    now: Date,
  ): Promise<{ status: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<TicketRow[]>`
          SELECT id, status, flow, applicant_sub, current_holder_sub, round_no,
                 status_entered_at, reconcile_flag
          FROM ticket WHERE id = ${ticketId} FOR UPDATE`
        const row = rows[0]
        if (!row) throw new TicketNotFoundError(ticketId)
        // A pending reconcile flag (DCC reported a missing/wrong hardcopy) must
        // block closure — DCC1 has to re-hand over or Return it first.
        if (row.reconcile_flag) {
          throw new ReconcileStateError('Đang chờ kiểm tra lại — DCC1 cần xử lý trước')
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
        // The number lands in the flow's own column: DCC2 → contract_no, DCC3 →
        // payment_no. BOTH are normalised UPPERCASE so the per-flow unique index is
        // effectively case-insensitive (MED-2 — a paper number differing only in
        // case is the same number, not a new one; storing Payment No verbatim let two
        // Payment tickets hold `pmt-a1` and `PMT-A1` at once). A Payment's existing
        // contract_no (the Applicant's reference) is untouched. The audit meta records
        // the SAME (stored) value so the log matches the DB.
        const storedNumber = documentNo.toUpperCase()
        const out = transition(state, {
          event: TICKET_EVENT.SendToAccounting,
          actor,
          now,
          meta: { documentNo: storedNumber, sentToAccountingAt: now.toISOString() },
        })
        const numberColumn =
          state.flow === FLOW.Payment ? { paymentNo: storedNumber } : { contractNo: storedNumber }
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            ...numberColumn,
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
            meta: out.event.meta as object,
          },
        })
        return { status: out.ticket.status }
      })
    } catch (e) {
      // Only a contract_no / payment_no partial-unique maps to a duplicate — don't
      // mask an unrelated unique violation as a number clash (code-review #4).
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' &&
        /contract_no|payment_no/.test(String(e.meta?.target ?? ''))
      ) {
        throw new DocumentNoDuplicateError(`Số "${documentNo}" đã tồn tại`)
      }
      throw e
    }
  }
}
