import { ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import type { Edge } from './types'

/**
 * Flow-agnostic edges (every flow): pickup→Andy, pre-mint & Andy reject→Returned,
 * cancel, and the 2-phase Return (Returned → Return-fixing → resubmit). All Return
 * edges here are light (no `enteredFlow`) — they happen before external processing.
 */
export const SHARED_EDGES: readonly Edge[] = [
  {
    from: TICKET_STATUS.Submitted,
    event: TICKET_EVENT.SubmitToAndy,
    to: TICKET_STATUS.SubmittedToVpAndy,
    ownerRole: ROLE.Dcc1,
    flow: '*',
    reversible: true,
  },
  {
    // Wrong document type caught at reception, before a code is minted (FR-15).
    from: TICKET_STATUS.Submitted,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: '*',
    reversible: false,
  },
  {
    from: TICKET_STATUS.SubmittedToVpAndy,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: '*',
    reversible: false,
  },
  {
    from: TICKET_STATUS.Submitted,
    event: TICKET_EVENT.Cancel,
    to: TICKET_STATUS.Cancelled,
    ownerRole: ROLE.Applicant,
    flow: '*',
    reversible: false,
  },
  {
    from: TICKET_STATUS.Returned,
    event: TICKET_EVENT.ConfirmReturnReceipt,
    to: TICKET_STATUS.ReturnFixing,
    ownerRole: ROLE.Applicant,
    flow: '*',
    reversible: false,
  },
  {
    from: TICKET_STATUS.ReturnFixing,
    event: TICKET_EVENT.Resubmit,
    to: TICKET_STATUS.Submitted,
    ownerRole: ROLE.Applicant,
    flow: '*',
    reversible: false,
    // No round bump here — the round was already counted at a heavy sendBack.
  },
  {
    // Reopen a closed ticket (FR-17, no time limit). DCC1 only; irreversible.
    from: TICKET_STATUS.Completed,
    event: TICKET_EVENT.Reopen,
    to: TICKET_STATUS.Reopened,
    ownerRole: ROLE.Dcc1,
    flow: '*',
    reversible: false,
  },
  {
    // Reopened → back to the Applicant for a fresh round (heavy: it was closed).
    from: TICKET_STATUS.Reopened,
    event: TICKET_EVENT.SendBack,
    to: TICKET_STATUS.Returned,
    ownerRole: ROLE.Dcc1,
    flow: '*',
    reversible: false,
    enteredFlow: true,
  },
]
