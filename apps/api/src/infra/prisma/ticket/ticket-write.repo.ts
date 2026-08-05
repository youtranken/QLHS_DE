import { Injectable } from '@nestjs/common'
import {
  isTerminal,
  TICKET_EVENT,
  TICKET_STATUS,
  type Flow,
  type Priority,
  type TicketStatus,
} from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import {
  FieldsLockedError,
  PriorityLockedError,
  TicketNotClosedError,
} from '../../../application/core/ticket-errors'
import { TicketNotFoundError } from '../../../domain/errors'
import { diffFields, type ApplicantFields } from '../../../domain/ticket/applicant-fields'
import { mapFlow } from '../../../domain/ticket/document-flow'

export interface CreateTicketInput {
  applicantSub: string
  flow: Flow
  priority: Priority
  fields: ApplicantFields
}

/**
 * Non-transition ticket writes: create (+ 'created' audit), priority change
 * (+ 'priority_changed' audit, B6), field edits and reopen-request notes.
 * Status is NEVER written here — only transition() does that (AD-2).
 */
@Injectable()
export class TicketWriteRepo {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTicketInput): Promise<{ id: string }> {
    const f = input.fields
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          status: TICKET_STATUS.Submitted,
          flow: input.flow,
          code: null,
          priority: input.priority,
          applicantSub: input.applicantSub,
          currentHolderSub: null,
          roundNo: 0,
          documentType: f.documentType,
          description: f.description,
          paymentTerm: f.paymentTerm,
          contractNo: f.contractNo,
          projectTeam: f.projectTeam,
          currency: f.currency,
          amount: f.amount,
          budgetCode: f.budgetCode,
          contractor: f.contractor,
        },
      })
      await tx.ticketEvent.create({
        data: {
          ticketId: t.id,
          actorSub: input.applicantSub,
          action: TICKET_EVENT.Created,
          fromStatus: TICKET_STATUS.Submitted,
          toStatus: TICKET_STATUS.Submitted,
          roundNo: 0,
          occurredAt: new Date(),
        },
      })
      return { id: t.id }
    })
  }

  /**
   * DCC2/DCC3 "Đề nghị Reopen" (B6): a typed audit note on a closed ticket that
   * flags DCC1 — it does NOT change status (only DCC1 actually reopens). Enforced:
   * the ticket must be in the caller's flow scope (AD-16; cross-flow → 404 no-leak)
   * and must be a reopenable closed status (FR-17; Cancelled is closed but dead).
   */
  async writeReopenRequest(id: string, actorSub: string, flows: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.findUnique({ where: { id } })
      if (!t || !flows.includes(t.flow)) throw new TicketNotFoundError(id)
      if (t.status === TICKET_STATUS.Cancelled || !isTerminal(t.status as TicketStatus)) {
        throw new TicketNotClosedError('Chỉ đề nghị mở lại hồ sơ đã đóng')
      }
      await tx.ticketEvent.create({
        data: {
          ticketId: id,
          actorSub,
          action: TICKET_EVENT.ReopenRequested,
          fromStatus: t.status,
          toStatus: t.status,
          roundNo: t.roundNo,
          occurredAt: new Date(),
        },
      })
    })
  }

  async changePriority(id: string, actorSub: string, next: Priority): Promise<void> {
    await this.writePriority(id, actorSub, next, true)
  }

  /** M6: DCC1 re-prioritises in any state (no Submitted-only guard). */
  async changePriorityAnyState(id: string, actorSub: string, next: Priority): Promise<void> {
    await this.writePriority(id, actorSub, next, false)
  }

  /**
   * Applicant edits the 9 fields — field-mutability window (NFR-2): while still in
   * the Pool (`Submitted`, nobody picked it yet) or during a return round
   * (`Return-fixing`). Each changed field appends one `field_changed` TicketEvent
   * (B6); status/code are never touched here.
   */
  async updateFields(id: string, actorSub: string, next: ApplicantFields): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.findFirst({ where: { id, applicantSub: actorSub } })
      if (!t) throw new TicketNotFoundError(id)
      const editable: string[] = [TICKET_STATUS.Submitted, TICKET_STATUS.ReturnFixing]
      if (!editable.includes(t.status)) {
        throw new FieldsLockedError('Chỉ sửa được khi hồ sơ ở Pool (Submitted) hoặc Return-fixing')
      }
      // DB columns are nullable, but the 9 fields are non-empty once created;
      // coerce defensively so the diff compares like-for-like strings.
      const prev: ApplicantFields = {
        documentType: (t.documentType ?? '') as ApplicantFields['documentType'],
        description: t.description ?? '',
        paymentTerm: t.paymentTerm ?? '',
        contractNo: t.contractNo ?? '',
        projectTeam: t.projectTeam ?? '',
        currency: t.currency ?? '',
        amount: t.amount ?? 0n,
        budgetCode: t.budgetCode ?? '',
        contractor: t.contractor ?? '',
      }
      const changes = diffFields(prev, next)
      if (changes.length === 0) return

      // Atomic re-check of the mutability window: if a concurrent transition() moved
      // the ticket out of Pool/Return-fixing between the read above and now, this
      // matches 0 rows and we refuse — the field write never lands on a moved ticket.
      const res = await tx.ticket.updateMany({
        where: { id, applicantSub: actorSub, status: { in: editable } },
        data: {
          documentType: next.documentType,
          // documentType can cross a flow boundary (General → Payment) — keep the
          // derived `flow` in sync, BUT only while still in Pool (code not minted).
          // Once `code` is minted (G-/CT-…) it's immutable and encodes the flow, so
          // recomputing flow at Return-fixing would desync code↔flow forever.
          flow: t.code === null ? mapFlow(next.documentType) : t.flow,
          description: next.description,
          paymentTerm: next.paymentTerm,
          contractNo: next.contractNo,
          projectTeam: next.projectTeam,
          currency: next.currency,
          amount: next.amount,
          budgetCode: next.budgetCode,
          contractor: next.contractor,
        },
      })
      if (res.count === 0) {
        throw new FieldsLockedError('Hồ sơ đã rời cửa sổ chỉnh sửa (đã được tiếp nhận)')
      }
      for (const c of changes) {
        await tx.ticketEvent.create({
          data: {
            ticketId: id,
            actorSub,
            action: TICKET_EVENT.FieldChanged,
            fromStatus: t.status,
            toStatus: t.status,
            roundNo: t.roundNo,
            occurredAt: new Date(),
            meta: { field: c.field, old: c.old, new: c.new },
          },
        })
      }
    })
  }

  private async writePriority(
    id: string,
    actorSub: string,
    next: Priority,
    poolOnly: boolean,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.findUnique({ where: { id } })
      if (!t) throw new TicketNotFoundError(id)
      if (poolOnly && t.status !== TICKET_STATUS.Submitted) {
        throw new PriorityLockedError('Chỉ đổi ưu tiên khi còn ở Pool (Submitted)')
      }
      if (t.priority === next) return
      await tx.ticket.update({ where: { id }, data: { priority: next } })
      await tx.ticketEvent.create({
        data: {
          ticketId: id,
          actorSub,
          action: TICKET_EVENT.PriorityChanged,
          fromStatus: t.status,
          toStatus: t.status,
          roundNo: t.roundNo,
          occurredAt: new Date(),
          meta: { old: t.priority, new: next },
        },
      })
    })
  }
}
