import type { TicketEvent, TicketStatus } from '@qlhs/contracts'

/**
 * One immutable audit row (AD-4). The whole history — every round, return,
 * reopen, and Undo compensating transition — is reconstructable from these.
 */
export interface TicketEventRecord {
  ticketId: string
  actorSub: string
  action: TicketEvent
  fromStatus: TicketStatus
  toStatus: TicketStatus
  reason?: string
  roundNo: number
  occurredAt: Date
  meta?: Record<string, unknown>
}

/**
 * The ONLY writer of ticket_event is transition() (AD-4). No interceptor, repo,
 * or job appends. Backed by a GRANT INSERT+SELECT role at the DB.
 */
export interface AuditPort {
  append(event: TicketEventRecord): Promise<void>
}
