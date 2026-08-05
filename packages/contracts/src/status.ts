/**
 * Canonical ticket statuses (AD-13). The English string values are THE source
 * of truth, used verbatim across tab/chip/metro/log/actionbar on FE, BE and
 * audit. Vietnamese labels are presentation-only and live in the web layer.
 *
 * Keys are readable identifiers; values are the canonical EN strings (PRD §4.1).
 * The state-machine EDGES (transitions) are owned by story 1.3 — this module
 * only fixes the closed set of status names + which of them are terminal.
 */
export const TICKET_STATUS = {
  Submitted: 'Submitted',
  SubmittedToVpAndy: 'Submitted to VP Andy',
  SubmittedToDcc2: 'Submitted to DCC2',
  ReceivedByDcc2: 'Received by DCC2',
  SubmittedToDcc3: 'Submitted to DCC3',
  ReceivedByDcc3: 'Received by DCC3',
  SubmittedToAccounting: 'Submitted to Accounting',
  ReceivedFromAcc: 'Received from ACC',
  SubmittedToBop: 'Submitted to BOP',
  SubmittedToDcc2Hardcopy: 'Submitted to DCC2 (Hardcopy)',
  Hardcopy: 'Hardcopy',
  SentToAccounting: 'Sent to Accounting',
  Completed: 'Completed',
  Returned: 'Returned',
  ReturnFixing: 'Return-fixing',
  Reopened: 'Reopened',
  Cancelled: 'Cancelled',
} as const

export type TicketStatus = (typeof TICKET_STATUS)[keyof typeof TICKET_STATUS]

export const ALL_STATUSES: readonly TicketStatus[] = Object.values(TICKET_STATUS)

/**
 * Terminal (closed) statuses — a ticket here is done: no next action, so no SLA
 * badge (PRD §8.2). `Sent to Accounting` is the Payment-only closed state, kept
 * distinct from `Submitted to Accounting` (Contract, in-flight) and `Completed`.
 */
export const TERMINAL_STATUSES: readonly TicketStatus[] = [
  TICKET_STATUS.Completed,
  TICKET_STATUS.SentToAccounting,
  TICKET_STATUS.Cancelled,
]

export function isTerminal(status: TicketStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}
