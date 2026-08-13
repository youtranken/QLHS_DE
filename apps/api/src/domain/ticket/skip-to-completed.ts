import { ROLE, TICKET_EVENT, type Role, type TicketEvent } from '@qlhs/contracts'

/**
 * DCC2 "Skip Completed" fast-forward (Contract flow only): from `Received by DCC2`
 * straight through to `Completed`, running EVERY real Contract edge — including the
 * ACC + BOP steps that normally belong to DCC1 — so the audit trail is complete,
 * not a single jump. It deliberately crosses roles: the orchestrating repo runs
 * each step with a per-step system actor whose role matches the edge, relaxing
 * AD-2's owner check for this one path (a business decision — see the popup's
 * "Skip Completed" checkbox). Every step carries the same skip note shown in detail.
 */
export interface SkipStep {
  event: TicketEvent
  role: Role
}

export const SKIP_COMPLETED_REASON = 'Skip completed (Hồ sơ không cần trình Acc)'

/** Ordered chain `Received by DCC2` → … → `Completed`. Kept as data (not inlined in
 *  the repo) so a pure test can walk it through the state-machine and prove it is a
 *  legal, role-correct path end-to-end. */
export const SKIP_TO_COMPLETED_STEPS: readonly SkipStep[] = [
  { event: TICKET_EVENT.SendToAccounting, role: ROLE.Dcc2 },
  { event: TICKET_EVENT.ReceiveFromAcc, role: ROLE.Dcc1 },
  { event: TICKET_EVENT.SubmitToBop, role: ROLE.Dcc1 },
  { event: TICKET_EVENT.BopApprove, role: ROLE.Dcc1 },
  { event: TICKET_EVENT.ConfirmReceivedByDcc2, role: ROLE.Dcc2 },
  { event: TICKET_EVENT.CompleteContract, role: ROLE.Dcc2 },
]
