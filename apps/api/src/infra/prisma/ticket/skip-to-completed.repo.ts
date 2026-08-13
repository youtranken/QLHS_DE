import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  FLOW,
  SYSTEM_SUB,
  TICKET_EVENT,
  type Flow,
  type TicketEvent,
  type TicketStatus,
} from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import {
  DocumentNoDuplicateError,
  ReconcileStateError,
} from '../../../application/core/ticket-errors'
import { TicketNotFoundError } from '../../../domain/errors'
import {
  IllegalTransitionError,
  transition,
  type TicketState,
} from '../../../domain/ticket/transition'
import {
  SKIP_COMPLETED_REASON,
  SKIP_TO_COMPLETED_STEPS,
} from '../../../domain/ticket/skip-to-completed'
import { writeEmailIntent } from '../notify/outbox.writer'

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
 * DCC2 "Skip Completed" (Contract only): one transaction locks the ticket once and
 * runs the whole `Received by DCC2 → Completed` chain (SKIP_TO_COMPLETED_STEPS) —
 * every status change + its audit row committing together (AD-2/AD-14). It is
 * all-or-nothing: a failure at any step rolls back the whole fast-forward, so a
 * ticket is never left half-advanced. Contract No lands in `contract_no` on the
 * first step (UPPERCASE, MED-2); the DB partial-unique index is the final TOCTOU
 * guard (AD-20) → a concurrent duplicate surfaces as P2002.
 */
@Injectable()
export class SkipToCompletedRepo {
  constructor(private readonly prisma: PrismaService) {}

  async skip(
    ticketId: string,
    actorSub: string,
    documentNo: string,
    now: Date,
  ): Promise<{ status: string }> {
    const storedNumber = documentNo.toUpperCase()
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<TicketRow[]>`
          SELECT id, status, flow, applicant_sub, current_holder_sub, round_no,
                 status_entered_at, reconcile_flag
          FROM ticket WHERE id = ${ticketId} FOR UPDATE`
        const row = rows[0]
        if (!row) throw new TicketNotFoundError(ticketId)
        if (row.reconcile_flag) {
          throw new ReconcileStateError('Đang chờ kiểm tra lại — DCC1 cần xử lý trước')
        }
        if (row.flow !== FLOW.Contract) {
          throw new IllegalTransitionError('Skip Completed chỉ áp dụng cho luồng Contract')
        }

        let state: TicketState = {
          id: row.id,
          status: row.status as TicketStatus,
          flow: row.flow as Flow,
          applicantSub: row.applicant_sub,
          currentHolderSub: row.current_holder_sub,
          roundNo: row.round_no,
          statusEnteredAt: row.status_entered_at,
        }

        // Every step runs as the system (SYSTEM_SUB, shown as "Hệ thống"): the
        // caller triggers the skip but does not personally perform the ACC/BOP
        // steps, so the append-only audit must not attribute them to a named user
        // (AD-4). The triggering DCC2 user is kept as a `skippedBy` breadcrumb in
        // step-1 meta. Only the FINAL row state is observable, so the ticket row is
        // written once after the chain (each step still appends its own audit row).
        for (const step of SKIP_TO_COMPLETED_STEPS) {
          const out = transition(state, {
            event: step.event,
            actor: { sub: SYSTEM_SUB, activeRole: step.role },
            now,
            reason: SKIP_COMPLETED_REASON,
            meta: metaFor(step.event, storedNumber, now, actorSub),
          })
          await tx.ticketEvent.create({
            data: {
              ticketId,
              actorSub: out.event.actorSub,
              action: out.event.action,
              fromStatus: out.event.fromStatus,
              toStatus: out.event.toStatus,
              reason: out.event.reason ?? null,
              roundNo: out.event.roundNo,
              occurredAt: out.event.occurredAt,
              meta: out.event.meta === undefined ? undefined : (out.event.meta as object),
            },
          })
          // Same-tx email intent (AD-15): only the Completed step queues the
          // Applicant email; every earlier step no-ops via the matrix.
          await writeEmailIntent(tx, {
            ticketId,
            toStatus: out.ticket.status,
            roundNo: out.ticket.roundNo,
            recipientSub: out.ticket.applicantSub,
          })
          state = out.ticket
        }
        await tx.ticket.update({
          where: { id: ticketId },
          data: {
            contractNo: storedNumber,
            status: state.status,
            currentHolderSub: state.currentHolderSub,
            roundNo: state.roundNo,
            statusEnteredAt: state.statusEnteredAt,
          },
        })
        return { status: state.status }
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' &&
        /contract_no/.test(String(e.meta?.target ?? ''))
      ) {
        throw new DocumentNoDuplicateError(`Số "${documentNo}" đã tồn tại`)
      }
      throw e
    }
  }
}

/** Per-step audit meta, mirroring the single-step use-cases so the log reads the
 *  same whether a step ran normally or via the skip: sendToAccounting records the
 *  stored number + timestamp, receiveFromAcc records the receipt date. */
function metaFor(
  event: TicketEvent,
  storedNumber: string,
  now: Date,
  skippedBy: string,
): Record<string, unknown> | undefined {
  if (event === TICKET_EVENT.SendToAccounting) {
    // `skippedBy` = the DCC2 user who triggered the fast-forward (the audit actor
    // is SYSTEM_SUB; this keeps a trace of who initiated it).
    return { documentNo: storedNumber, sentToAccountingAt: now.toISOString(), skippedBy }
  }
  if (event === TICKET_EVENT.ReceiveFromAcc) {
    return { receivedFromAccAt: now.toISOString() }
  }
  return undefined
}
