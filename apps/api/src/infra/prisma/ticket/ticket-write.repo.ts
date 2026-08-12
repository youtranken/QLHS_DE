import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import {
  FLOW,
  TICKET_EVENT,
  TICKET_STATUS,
  type Flow,
  type Priority,
  type TicketStatus,
} from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import {
  DocumentNoDuplicateError,
  FieldsLockedError,
  PriorityLockedError,
} from '../../../application/core/ticket-errors'
import { TicketNotFoundError } from '../../../domain/errors'
import {
  diffFields,
  normalizeContractNo,
  type ApplicantFields,
} from '../../../domain/ticket/applicant-fields'

/** The Contract No partial-unique index (Contract flow) is the final guard, so
 *  create and field edits translate its P2002 into a friendly duplicate error
 *  instead of a 500. (Payment references are NOT unique — many payments per
 *  contract — so this only fires on a genuine Contract-No clash.) */
function asContractNoDuplicate(e: unknown, contractNo: string): never {
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === 'P2002' &&
    /contract_no|payment_no/.test(String(e.meta?.target ?? ''))
  ) {
    throw new DocumentNoDuplicateError(`Contract No "${contractNo}" đã tồn tại`)
  }
  throw e
}

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
    // Contract No is DCC2-owned on the Contract flow (AD-16) — force the applicant
    // slot to 'N/A' here so a clone of a numbered Contract ticket (FR-3) or any
    // direct API create can't seed/collide a real Contract No the DB unique index
    // then rejects. Payment/General references are kept (uppercased).
    const f = normalizeContractNo(input.fields, input.flow)
    return this.createTx(input, f).catch((e) => asContractNoDuplicate(e, f.contractNo))
  }

  private createTx(input: CreateTicketInput, f: ApplicantFields): Promise<{ id: string }> {
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
  async updateFields(id: string, actorSub: string, rawNext: ApplicantFields, resolvedFlow: Flow): Promise<void> {
    const incoming = normalizeContractNo(rawNext, resolvedFlow)
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.ticket.findFirst({ where: { id, applicantSub: actorSub } })
      if (!t) throw new TicketNotFoundError(id)
      const editable: string[] = [TICKET_STATUS.Submitted, TICKET_STATUS.ReturnFixing]
      if (!editable.includes(t.status)) {
        throw new FieldsLockedError('Chỉ sửa được khi hồ sơ ở Pool (Submitted) hoặc Return-fixing')
      }
      // Once a code is minted the flow is immutable (it's encoded in the code), so
      // the Document Type may only move WITHIN its own flow family. Crossing to
      // another flow's type (e.g. General → a Contract type at Return-fixing) would
      // desync code↔flow↔documentType — the UI already restricts the dropdown; this
      // is the server-side guard behind it.
      if (t.code !== null && resolvedFlow !== t.flow) {
        throw new FieldsLockedError('Không đổi được loại hồ sơ sang luồng khác sau khi đã cấp mã')
      }
      // Contract No is DCC2-owned — the applicant NEVER writes it (AD-16, MED-1).
      // `incoming` already pinned the Contract-flow slot to 'N/A' (pre-DCC2); once
      // DCC2 has minted the code + assigned the number, pin to the STORED value so a
      // crafted PATCH at Return-fixing can't overwrite or wipe it (the FE shows it
      // read-only; this is the server guard behind that). Payment/General keep the
      // applicant's normalized reference.
      const next: ApplicantFields =
        resolvedFlow === FLOW.Contract && t.code !== null
          ? { ...incoming, contractNo: t.contractNo ?? 'N/A' }
          : incoming
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
          // `resolvedFlow` comes from the catalog-backed FlowResolver (handles
          // admin-added types); a bare mapFlow here returned undefined for them,
          // which Prisma skips → documentType changed but flow stayed stale.
          flow: t.code === null ? resolvedFlow : t.flow,
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
    }).catch((e) => asContractNoDuplicate(e, incoming.contractNo))
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
