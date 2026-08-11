import { Injectable } from '@nestjs/common'
import { TICKET_EVENT, TICKET_STATUS, type Flow, type TicketEvent, type TicketStatus } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import { writeEmailIntent } from '../notify/outbox.writer'
import { ReconcileStateError } from '../../../application/core/ticket-errors'
import { TicketNotFoundError } from '../../../domain/errors'
import { RECONCILE_REASON } from '../../../domain/ticket/reconcile'
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
  reconcile_reason: string | null
}

/** The two DCC2 receipt-waiting states where a "missing paper" bounce applies. */
const HANDOVER_STATES: readonly string[] = [
  TICKET_STATUS.SubmittedToDcc2,
  TICKET_STATUS.SubmittedToDcc2Hardcopy,
]
/** The single DCC3 receipt-waiting state (Payment has one handover, Story 4.1). */
const HANDOVER_STATES_DCC3: readonly string[] = [TICKET_STATUS.SubmittedToDcc3]
/** The DCC2-held states from which DCC2 may push a wrong hardcopy back to DCC1. */
const PUSHBACK_STATES: readonly string[] = [TICKET_STATUS.ReceivedByDcc2, TICKET_STATUS.Hardcopy]

/**
 * DCC2 handover exceptions (AD-10/AD-11, Stories 3.1/3.4). "Missing paper" and
 * "request return" both flag the ticket (reconcile_flag + reason) so it bounces
 * off DCC2's board into DCC1's reconcile lane — but only "missing paper" keeps
 * the status; "return" hands off to DCC1 who runs the sendBack. All flag toggles
 * lock the row (FOR UPDATE) so a concurrent action can't strand the flag.
 */
@Injectable()
export class HandoverRepo {
  constructor(private readonly prisma: PrismaService) {}

  /** DCC2 flags a missing hardcopy → status-preserving bounce to DCC1. The
   *  `comment` (why) is recorded on the audit event so DCC1 sees it in the log. */
  flagMissingPaper(id: string, actorSub: string, comment?: string): Promise<void> {
    return this.setReconcile(id, actorSub, HANDOVER_STATES, RECONCILE_REASON.MissingPaper, true, comment)
  }

  /** DCC1 re-hands over after reconciling → clears the flag, status unchanged. */
  clearMissingPaper(id: string, actorSub: string): Promise<void> {
    return this.setReconcile(id, actorSub, HANDOVER_STATES, null, false)
  }

  /** DCC3 flags a missing hardcopy at `Submitted to DCC3` (Payment, Story 4.1). */
  flagMissingPaperDcc3(id: string, actorSub: string, comment?: string): Promise<void> {
    return this.setReconcile(id, actorSub, HANDOVER_STATES_DCC3, RECONCILE_REASON.MissingPaper, true, comment)
  }

  /** DCC1 re-hands over a reconciled Payment ticket → clears the flag. */
  clearMissingPaperDcc3(id: string, actorSub: string): Promise<void> {
    return this.setReconcile(id, actorSub, HANDOVER_STATES_DCC3, null, false)
  }

  /** DCC2 "đẩy ngược DCC1" (AC4, AD-11): flag with a return reason so DCC1 sees it
   *  in the reconcile lane and completion is locked out; DCC1 runs the Return. The
   *  `comment` (why the hardcopy is wrong) is recorded on the audit event. */
  requestReturn(id: string, actorSub: string, comment?: string): Promise<void> {
    return this.setReconcile(id, actorSub, PUSHBACK_STATES, RECONCILE_REASON.ReturnRequested, true, comment)
  }

  /**
   * DCC2/DCC3 confirms the hardcopy (phase 2) — the reconcile-flag check and the
   * transition run in ONE locked transaction so a concurrent missing-paper flag
   * can't slip past and strand the flag on a forward state (code-review #3). The
   * `event` selects the flow's confirm edge (ConfirmReceivedByDcc2/Dcc3).
   */
  async confirmReceived(
    id: string,
    actor: Actor,
    event: TicketEvent,
    receivedAt: Date,
    now: Date,
  ): Promise<{ status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<TicketRow[]>`
        SELECT id, status, flow, applicant_sub, current_holder_sub, round_no,
               status_entered_at, reconcile_flag, reconcile_reason
        FROM ticket WHERE id = ${id} FOR UPDATE`
      const row = rows[0]
      if (!row) throw new TicketNotFoundError(id)
      if (row.reconcile_flag) {
        throw new ReconcileStateError('Đang chờ kiểm tra lại — DCC1 cần bàn giao lại trước')
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
      const out = transition(state, {
        event,
        actor,
        now,
        meta: { receivedFromDcc1At: receivedAt.toISOString() },
      })
      await tx.ticket.update({
        where: { id },
        data: {
          status: out.ticket.status,
          currentHolderSub: out.ticket.currentHolderSub,
          roundNo: out.ticket.roundNo,
          statusEnteredAt: out.ticket.statusEnteredAt,
        },
      })
      await tx.ticketEvent.create({
        data: {
          ticketId: id,
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
  }

  /**
   * DCC1 resolves a push-back: clears the flag AND runs the heavy `sendBack` in
   * one locked transaction (no stranded flag). Guarded to return_requested only.
   */
  async returnFromPushback(id: string, actor: Actor, reason: string, now: Date): Promise<{ status: string }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<TicketRow[]>`
        SELECT id, status, flow, applicant_sub, current_holder_sub, round_no,
               status_entered_at, reconcile_flag, reconcile_reason
        FROM ticket WHERE id = ${id} FOR UPDATE`
      const row = rows[0]
      if (!row) throw new TicketNotFoundError(id)
      if (!row.reconcile_flag || row.reconcile_reason !== RECONCILE_REASON.ReturnRequested) {
        throw new ReconcileStateError('Hồ sơ không ở trạng thái chờ DCC1 trả lại')
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
      const out = transition(state, { event: TICKET_EVENT.SendBack, actor, now, reason })
      await tx.ticket.update({
        where: { id },
        data: {
          reconcileFlag: false,
          reconcileReason: null,
          status: out.ticket.status,
          currentHolderSub: out.ticket.currentHolderSub,
          roundNo: out.ticket.roundNo,
          statusEnteredAt: out.ticket.statusEnteredAt,
        },
      })
      await tx.ticketEvent.create({
        data: {
          ticketId: id,
          actorSub: out.event.actorSub,
          action: out.event.action,
          fromStatus: out.event.fromStatus,
          toStatus: out.event.toStatus,
          reason: out.event.reason ?? null,
          roundNo: out.event.roundNo,
          occurredAt: out.event.occurredAt,
        },
      })
      // Return → Applicant email intent (AD-15), same transaction.
      await writeEmailIntent(tx, {
        ticketId: id,
        toStatus: out.ticket.status,
        roundNo: out.ticket.roundNo,
        recipientSub: row.applicant_sub,
      })
      return { status: out.ticket.status }
    })
  }

  /** Toggle the reconcile flag to `next` (guarded: allowed state, not a no-op),
   *  writing the matching typed audit note. `reason` is applied only when setting. */
  private async setReconcile(
    id: string,
    actorSub: string,
    allowedFrom: readonly string[],
    reason: string | null,
    next: boolean,
    comment?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<TicketRow[]>`
        SELECT id, status, reconcile_flag, round_no FROM ticket WHERE id = ${id} FOR UPDATE`
      const t = rows[0]
      if (!t) throw new TicketNotFoundError(id)
      if (!allowedFrom.includes(t.status)) {
        throw new ReconcileStateError('Hành động không hợp lệ ở trạng thái hiện tại')
      }
      if (t.reconcile_flag === next) {
        throw new ReconcileStateError(
          next ? 'Hồ sơ đã được đánh dấu' : 'Hồ sơ không ở trạng thái chờ kiểm tra lại',
        )
      }
      await tx.ticket.update({
        where: { id },
        data: { reconcileFlag: next, reconcileReason: next ? reason : null },
      })
      await tx.ticketEvent.create({
        data: {
          ticketId: id,
          actorSub,
          action:
            next && reason === RECONCILE_REASON.ReturnRequested
              ? TICKET_EVENT.ReturnRequested
              : next
                ? TICKET_EVENT.MissingPaperFlagged
                : TICKET_EVENT.MissingPaperCleared,
          fromStatus: t.status,
          toStatus: t.status,
          reason: next && comment?.trim() ? comment.trim() : null,
          roundNo: t.round_no,
          occurredAt: new Date(),
        },
      })
    })
  }
}
