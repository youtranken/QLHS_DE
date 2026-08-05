/**
 * 2.2 — when is a notification still "unread" for a person?
 *
 * A personal notification (recipient_sub) stays unread until that person reads
 * it — it is information addressed to them. A role-inbox notification
 * (waiting_status set) also auto-resolves once the ticket LEAVES that station:
 * someone in the group picked it up, so the rest are no longer owed the nudge.
 * This is derived at read (AD-6 style) from the ticket's current status, never
 * stored — so one DCC acting clears it for the group without touching anyone
 * else's personal read state.
 */
export interface ReadInput {
  /** This user has an explicit read mark. */
  readByMe: boolean
  /** The station a role-inbox notification is about; null for personal ones. */
  waitingStatus: string | null
  /** The ticket's status right now; null if the ticket is gone. */
  ticketStatus: string | null
}

export function isRead(n: ReadInput): boolean {
  if (n.readByMe) return true
  // Role inbox note whose ticket has moved on — the work is taken, treat as done.
  if (n.waitingStatus !== null && n.ticketStatus !== n.waitingStatus) return true
  return false
}
