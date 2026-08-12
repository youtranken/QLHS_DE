import { Injectable } from '@nestjs/common'
import { FLOW, TICKET_EVENT, type Role, type TicketEvent } from '@qlhs/contracts'
import { legalActions, findEdge } from '../../domain/ticket/state-machine/index'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { TicketNotFoundError } from '../../domain/errors'
import type { Flow, TicketStatus } from '@qlhs/contracts'

/** VI labels for the actionbar (AD-17 — labels travel with the derived actions). */
const LABEL: Partial<Record<TicketEvent, string>> = {
  [TICKET_EVENT.SubmitToAndy]: 'Trình Sếp',
  [TICKET_EVENT.AndyApproveComplete]: 'Sếp duyệt → hoàn tất',
  [TICKET_EVENT.AndyRequireBop]: 'Sếp đã duyệt → trình BOP',
  // BopApprove routes differently per flow (Contract → back to DCC2, General →
  // Completed), so its label is resolved flow-aware in labelFor(), not here.
  [TICKET_EVENT.SendBack]: 'Trả lại (Return)',
  [TICKET_EVENT.Cancel]: 'Thu hồi',
  [TICKET_EVENT.ConfirmReturnReceipt]: 'Xác nhận đã nhận lại',
  [TICKET_EVENT.Resubmit]: 'Nộp lại',
  [TICKET_EVENT.Reopen]: 'Mở lại (Reopen)',
  [TICKET_EVENT.HandoverToDcc2]: 'Chuyển cho DCC2 →',
  // Neutral label: the click opens a check modal where DCC2/DCC3 either confirms
  // receipt OR reports a missing/wrong hardcopy — not a blind "received".
  [TICKET_EVENT.ConfirmReceivedByDcc2]: 'Kiểm tra bản cứng',
  [TICKET_EVENT.HandoverToDcc3]: 'Chuyển cho DCC3 →',
  [TICKET_EVENT.ConfirmReceivedByDcc3]: 'Kiểm tra bản cứng',
  // Flow-aware in labelFor() — this fallback is the Contract wording.
  [TICKET_EVENT.SendToAccounting]: 'Nhập Contract No & gửi Accounting',
  [TICKET_EVENT.ReceiveFromAcc]: 'Nhận về từ ACC',
  [TICKET_EVENT.SubmitToBop]: 'Trình BOP →',
  [TICKET_EVENT.CompleteContract]: 'Hoàn tất & đóng hồ sơ',
}

export interface LegalAction {
  event: TicketEvent
  label: string
  toStatus: TicketStatus
  reversible: boolean
  reasonRequired: boolean
}

/** BopApprove hands the hardcopy back to DCC2 in Contract (2-phase, AD-10) but
 *  closes a General ticket — the label must read as the real next step per flow. */
function labelFor(event: TicketEvent, flow: Flow): string {
  if (event === TICKET_EVENT.BopApprove) {
    return flow === FLOW.Contract ? 'BOP duyệt → bàn giao DCC2' : 'BOP duyệt → hoàn tất'
  }
  // The value entered differs by flow (DCC2 a Contract No, DCC3 a Payment number),
  // so the action label names the right thing per flow.
  if (event === TICKET_EVENT.SendToAccounting) {
    return flow === FLOW.Payment
      ? 'Nhập Payment number & gửi ACC'
      : 'Nhập Contract No & gửi Accounting'
  }
  return LABEL[event] ?? event
}

/** Actions a role may take on a ticket now — derived from the central machine. */
export function legalActionsFor(status: TicketStatus, role: Role, flow: Flow): LegalAction[] {
  return legalActions(status, role, flow).map((event) => {
    const edge = findEdge(status, event, flow)
    return {
      event,
      label: labelFor(event, flow),
      toStatus: edge?.to ?? status,
      reversible: edge?.reversible ?? false,
      // Reopen chains into a sendBack, which mandates a reason. SubmitToBop and
      // AndyRequireBop take a required comment (DCC1's / Andy's note to BOP), shown
      // in the handover log.
      reasonRequired:
        event === TICKET_EVENT.SendBack ||
        event === TICKET_EVENT.Reopen ||
        event === TICKET_EVENT.SubmitToBop ||
        event === TICKET_EVENT.AndyRequireBop,
    }
  })
}

@Injectable()
export class LegalActionsUseCase {
  constructor(private readonly tickets: TicketQueryRepo) {}

  async execute(ticketId: string, role: Role): Promise<LegalAction[]> {
    const t = await this.tickets.findById(ticketId)
    if (!t) throw new TicketNotFoundError(ticketId)
    return legalActionsFor(t.status as TicketStatus, role, t.flow as Flow)
  }
}
