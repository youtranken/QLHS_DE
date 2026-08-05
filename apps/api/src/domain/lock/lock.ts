/**
 * Soft lock (AD-9): a DCC holds a ticket for up to 5 minutes of inactivity so
 * two people don't process it at once. Persisted in `ticket_lock` (UNIQUE
 * ticket_id) and enforced at the DB with a conditional upsert (AD-14).
 */
export interface TicketLock {
  ticketId: string
  holderSub: string
  acquiredAt: Date
  expiresAt: Date
}

export const LOCK_TTL_MS = 5 * 60 * 1000

export function isExpired(lock: TicketLock, now: Date): boolean {
  return lock.expiresAt.getTime() <= now.getTime()
}

/** True when someone ELSE holds a still-valid lock (the viewer is read-only). */
export function heldByOther(lock: TicketLock | null, now: Date, viewerSub: string): boolean {
  return lock !== null && !isExpired(lock, now) && lock.holderSub !== viewerSub
}

export interface AcquireResult {
  acquired: boolean
  holderSub: string
  expiresAt: Date
}

export interface LockPort {
  /** Acquire (or seize an expired) lock atomically; report the current holder. */
  acquireOrSeize(ticketId: string, holderSub: string, now: Date): Promise<AcquireResult>
  get(ticketId: string): Promise<TicketLock | null>
}
