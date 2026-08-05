/**
 * PMH ID offboarding webhook payload (NFR parity with QLTS). Pure: parsing +
 * classification only, no IO — the HMAC check (infra) and session kill (http)
 * live elsewhere. Users are keyed by PMH `sub` (AD-7); the wire field is
 * `user_id`, surfaced here as `userId`.
 */
export interface PmhWebhookEvent {
  type: string
  userId: string
  groups?: string[]
  eventId?: string
}

/** Events that must invalidate every local session for the user immediately. */
export const WEBHOOK_KICK_EVENTS = new Set(['user.locked', 'user.deleted', 'user.password_changed'])

/** locked/deleted also flip the local directory status (offboarding visibility). */
export const WEBHOOK_STATUS_BY_EVENT: Record<string, 'locked' | 'deleted'> = {
  'user.locked': 'locked',
  'user.deleted': 'deleted',
}

export function isKickEvent(type: string): boolean {
  return WEBHOOK_KICK_EVENTS.has(type)
}

/**
 * Parse + shape-validate the raw JSON body. Returns null when malformed so the
 * caller answers 400 — never 500, or PMH ID would retry a bad payload forever.
 */
export function parseWebhookEvent(rawUtf8: string): PmhWebhookEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawUtf8)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const e = parsed as Record<string, unknown>
  if (typeof e.type !== 'string' || typeof e.user_id !== 'string') return null
  if (e.groups !== undefined && !Array.isArray(e.groups)) return null
  if (e.event_id !== undefined && typeof e.event_id !== 'string') return null
  return {
    type: e.type,
    userId: e.user_id,
    groups: e.groups as string[] | undefined,
    eventId: e.event_id as string | undefined,
  }
}
