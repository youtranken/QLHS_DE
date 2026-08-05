/**
 * Why a ticket bounced off DCC2's board into DCC1's reconcile lane (AD-10/AD-11).
 * `missing_paper` → DCC1 re-hands over; `return_requested` → DCC1 Returns. The
 * value rides on `ticket.reconcile_reason` alongside the boolean `reconcile_flag`.
 */
export const RECONCILE_REASON = {
  MissingPaper: 'missing_paper',
  ReturnRequested: 'return_requested',
} as const

export type ReconcileReason = (typeof RECONCILE_REASON)[keyof typeof RECONCILE_REASON]
