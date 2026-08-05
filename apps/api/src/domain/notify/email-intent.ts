import { TICKET_STATUS, type TicketStatus } from '@qlhs/contracts'

/**
 * AD-15 / H5 — the single source of truth for which committed transition emits an
 * Applicant email intent. Returns the outbox `kind` (the status name) or null.
 *
 * Keyed by the to-status alone, which is stronger than keying by flow: Payment's
 * close is its OWN status (`Sent to Accounting`), distinct from `Completed`, so
 * the H5 "no email" rule falls out naturally — it can never be confused with a
 * General/Contract `Completed`. `Returned` always emails (Return + Reopen paths).
 * The dispatcher (Story 5.2) reads the outbox; this function decides what to write.
 */
export function emailIntentKind(toStatus: TicketStatus): string | null {
  if (toStatus === TICKET_STATUS.Completed) return TICKET_STATUS.Completed
  if (toStatus === TICKET_STATUS.Returned) return TICKET_STATUS.Returned
  // Everything else — incl. `Sent to Accounting` (Payment close, H5) and all
  // mid-flow states — writes no email intent.
  return null
}
