import { DomainError } from '../errors'

/** Only the person currently holding the ticket may stop or restart its clock. */
export class NotHolderError extends DomainError {
  readonly code = 'NotHolder'
}

/** A stopped SLA clock without a stated reason is unreviewable — refuse it. */
export class PauseReasonRequiredError extends DomainError {
  readonly code = 'PauseReasonRequired'
}

/** Pausing an already-paused ticket (or resuming one that runs) is a bug, not a
 *  workflow — it would double-count or invent forgiven days. */
export class PauseStateError extends DomainError {
  readonly code = 'PauseState'
}
