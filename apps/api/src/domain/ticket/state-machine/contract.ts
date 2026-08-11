import { FLOW, ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import type { Edge } from './types'

/**
 * Luồng B — Contract/VO/Annex/Budget. Forward line: Andy approve → handover to
 * DCC2 (2-phase, AD-10) → ACC → BOP → Hardcopy. ACC returning a ticket is a HEAVY
 * return (`enteredFlow`) — it had already reached external processing, so it
 * counts a new round (FR-15, PRD §6). The "missing paper" bounce is NOT an edge:
 * it keeps the status and only sets a reconcile flag (B6 note, see ticket.repo).
 */
export const CONTRACT_EDGES: readonly Edge[] = [
  {
    // Andy approved a Contract → DCC1 forwards to DCC2 (phase 1 of handover).
    from: TICKET_STATUS.SubmittedToVpAndy,
    event: TICKET_EVENT.HandoverToDcc2,
    to: TICKET_STATUS.SubmittedToDcc2,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Contract,
    reversible: true,
  },
  {
    // Phase 2: DCC2 confirms the physical hardcopy is in hand (records the date).
    from: TICKET_STATUS.SubmittedToDcc2,
    event: TICKET_EVENT.ConfirmReceivedByDcc2,
    to: TICKET_STATUS.ReceivedByDcc2,
    ownerRole: ROLE.Dcc2,
    flow: FLOW.Contract,
    reversible: false,
  },
  {
    // DCC2 records the Document No and sends the file to Accounting (FR-11).
    from: TICKET_STATUS.ReceivedByDcc2,
    event: TICKET_EVENT.SendToAccounting,
    to: TICKET_STATUS.SubmittedToAccounting,
    ownerRole: ROLE.Dcc2,
    flow: FLOW.Contract,
    reversible: false,
  },
  {
    // DCC1 takes the hardcopy back from ACC (2-phase reverse handover, records
    // the date). Owns the next step even though DCC2 was the sender (FR-12).
    from: TICKET_STATUS.SubmittedToAccounting,
    event: TICKET_EVENT.ReceiveFromAcc,
    to: TICKET_STATUS.ReceivedFromAcc,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Contract,
    reversible: false,
  },
  {
    // ACC approved → DCC1 submits to BOP. BOP runs at most once per round: the
    // only path here is this single edge, and the graph never returns to
    // Received from ACC within a round (FR-12).
    from: TICKET_STATUS.ReceivedFromAcc,
    event: TICKET_EVENT.SubmitToBop,
    to: TICKET_STATUS.SubmittedToBop,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Contract,
    reversible: true,
  },
  {
    // ACC return: heavy sendBack (already past external processing) → new round.
    from: TICKET_STATUS.ReceivedFromAcc,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Contract,
    reversible: false,
    enteredFlow: true,
  },
  {
    // BOP approved → DCC1 hands the hardcopy back to DCC2 (2-phase, AD-10).
    from: TICKET_STATUS.SubmittedToBop,
    event: TICKET_EVENT.BopApprove,
    to: TICKET_STATUS.SubmittedToDcc2Hardcopy,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Contract,
    reversible: true,
  },
  {
    // BOP rejected: heavy return (past external processing) → new round.
    from: TICKET_STATUS.SubmittedToBop,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Contract,
    reversible: false,
    enteredFlow: true,
  },
  {
    // Phase 2 of the post-BOP handover: DCC2 confirms the hardcopy is in hand.
    from: TICKET_STATUS.SubmittedToDcc2Hardcopy,
    event: TICKET_EVENT.ConfirmReceivedByDcc2,
    to: TICKET_STATUS.Hardcopy,
    ownerRole: ROLE.Dcc2,
    flow: FLOW.Contract,
    reversible: false,
  },
  {
    // DCC2 records the scan path and closes the Contract file (FR-12).
    from: TICKET_STATUS.Hardcopy,
    event: TICKET_EVENT.CompleteContract,
    to: TICKET_STATUS.Completed,
    ownerRole: ROLE.Dcc2,
    flow: FLOW.Contract,
    reversible: false,
  },
  {
    // DCC1's Return channel while a Contract sits in DCC2's inbox (either
    // handover). A wrong/incomplete hardcopy is reported by DCC2 AT RECEIPT
    // (reconcile flag, status-preserving); DCC1 then decides in the reconcile
    // lane to re-hand over OR Return here. The receipt-waiting states hold no
    // single holder and belong to DCC2's tab, so a DCC1-owned edge never leaks
    // as a stray DCC2 button. Heavy → new round (the Applicant's paper was wrong).
    from: TICKET_STATUS.SubmittedToDcc2,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Contract,
    reversible: false,
    enteredFlow: true,
  },
  {
    from: TICKET_STATUS.SubmittedToDcc2Hardcopy,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Contract,
    reversible: false,
    enteredFlow: true,
  },
]
