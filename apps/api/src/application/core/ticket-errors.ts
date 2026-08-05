import { DomainError } from '../../domain/errors'

export class NotTicketOwnerError extends DomainError {
  readonly code = 'NotTicketOwner'
}

/** Priority is editable only while Submitted (Conventions: Field mutability). */
export class PriorityLockedError extends DomainError {
  readonly code = 'PriorityLocked'
}

/** The 9 Applicant fields are editable only in Pool (Submitted) or at Return-fixing (NFR-2). */
export class FieldsLockedError extends DomainError {
  readonly code = 'FieldsLocked'
}

/** Reopen (and reopen-request) apply only to a closed ticket (FR-17). */
export class TicketNotClosedError extends DomainError {
  readonly code = 'TicketNotClosed'
}

/**
 * 2-phase handover reconcile guard (AD-10): missing-paper may only be flagged on
 * a `Submitted to DCC2` Contract ticket, cleared only while flagged, and a DCC2
 * receipt is refused while the flag is up.
 */
export class ReconcileStateError extends DomainError {
  readonly code = 'ReconcileState'
}

/** Document No was empty or over the length ceiling (early layer, AD-20). */
export class DocumentNoInvalidError extends DomainError {
  readonly code = 'DocumentNoInvalid'
}

/** DB partial-unique index rejected a duplicate Document No (M5 — final guard). */
export class DocumentNoDuplicateError extends DomainError {
  readonly code = 'DocumentNoDuplicate'
}

/** Completing a Contract Hardcopy requires a non-empty scan path (FR-12). */
export class ScanPathRequiredError extends DomainError {
  readonly code = 'ScanPathRequired'
}

/** An SLA threshold must be a positive whole number of days (Story 5.1, AC3). */
export class SlaDaysInvalidError extends DomainError {
  readonly code = 'SlaDaysInvalid'
}

/** The (status, flow) key must be canonical — a mistyped key would upsert a dead
 *  row that silently never matches any ticket (code-review, Story 5.1). */
export class SlaConfigKeyInvalidError extends DomainError {
  readonly code = 'SlaConfigKeyInvalid'
}
