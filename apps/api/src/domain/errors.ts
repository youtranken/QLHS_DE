/**
 * Base for all domain/application errors. The http layer maps `code` → status
 * via a single filter (AD-17); nothing else needs to know HTTP.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string
}

export class TicketNotFoundError extends DomainError {
  readonly code = 'TicketNotFound'
}
