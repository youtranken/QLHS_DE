/**
 * Why a ticket bounced off the DCC board into DCC1's reconcile lane (AD-10/AD-11).
 * `missing_paper` is the only reason produced now: DCC2/DCC3 reports a missing/wrong
 * hardcopy AT RECEIPT and DCC1 chooses in the lane to re-hand over OR Return.
 * `return_requested` is RETIRED (the old after-receipt push-back) — kept only so
 * historical `reconcile_reason` values still resolve to a name. The value rides on
 * `ticket.reconcile_reason` alongside the boolean `reconcile_flag`.
 */
export const RECONCILE_REASON = {
  MissingPaper: 'missing_paper',
  ReturnRequested: 'return_requested',
} as const

export type ReconcileReason = (typeof RECONCILE_REASON)[keyof typeof RECONCILE_REASON]
