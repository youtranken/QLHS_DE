import { FLOW, ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import type { Edge } from './types'

/**
 * Luồng C — Payment. The shortest line: Andy approve → 2-phase handover to DCC3
 * (AD-10) → send to Accounting = closed at `Sent to Accounting` in one hop (H5:
 * no BOP, no `Completed`, no email). Reopen from the closed state reuses the
 * shared `sendBack` (Story 4.3). The "missing paper" bounce is NOT an edge — it
 * keeps the status and only sets a reconcile flag (B6, see handover.repo).
 */
export const PAYMENT_EDGES: readonly Edge[] = [
  {
    // Andy approved a Payment → DCC1 forwards to DCC3 (phase 1 of handover).
    from: TICKET_STATUS.SubmittedToVpAndy,
    event: TICKET_EVENT.HandoverToDcc3,
    to: TICKET_STATUS.SubmittedToDcc3,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Payment,
    reversible: true,
  },
  {
    // Phase 2: DCC3 confirms the physical hardcopy is in hand (records the date).
    from: TICKET_STATUS.SubmittedToDcc3,
    event: TICKET_EVENT.ConfirmReceivedByDcc3,
    to: TICKET_STATUS.ReceivedByDcc3,
    ownerRole: ROLE.Dcc3,
    flow: FLOW.Payment,
    reversible: false,
  },
  {
    // DCC3 records the Document No and sends to ACC — this CLOSES Payment in one
    // hop at the terminal `Sent to Accounting` (H5: no BOP, no `Completed`, no
    // email; DCC3 never learns ACC's outcome). Same `sendToAccounting` event as
    // Contract, routed here by flow. Irreversible → fix only via Reopen (4.3).
    from: TICKET_STATUS.ReceivedByDcc3,
    event: TICKET_EVENT.SendToAccounting,
    to: TICKET_STATUS.SentToAccounting,
    ownerRole: ROLE.Dcc3,
    flow: FLOW.Payment,
    reversible: false,
  },
  {
    // DCC1's Return channel while a Payment sits in DCC3's inbox. DCC3 reports a
    // wrong/incomplete hardcopy AT RECEIPT (`Submitted to DCC3`, reconcile flag,
    // status-preserving); DCC1 then decides in the reconcile lane to re-hand over
    // OR Return here. Symmetric to Contract's `SubmittedToDcc2 --sendBack-->`.
    // DCC1 is the sole Return actor (AD-11); DCC3 only flags, never fires sendBack.
    // Heavy → counts a round. No after-receipt push-back (checked at receipt).
    from: TICKET_STATUS.SubmittedToDcc3,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Payment,
    reversible: false,
    enteredFlow: true,
  },
  {
    // The only post-close fix channel (Story 4.3, FR-14): ACC returns a wrong
    // hardcopy → DCC1 reopens the closed Payment. Chains into the shared
    // `Reopened --sendBack--> Returned` (heavy, counts a round). DCC1 only; the
    // ticket keeps its code + data + timeline. No time limit (PRD §6).
    from: TICKET_STATUS.SentToAccounting,
    event: TICKET_EVENT.Reopen,
    to: TICKET_STATUS.Reopened,
    ownerRole: ROLE.Dcc1,
    flow: FLOW.Payment,
    reversible: false,
  },
]
