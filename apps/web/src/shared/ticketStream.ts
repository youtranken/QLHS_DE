/**
 * 2.1 — one shared SSE connection for the whole tab. Components subscribe to
 * "a ticket changed"; the connection opens on the first subscriber and closes
 * when the last leaves, so three live boards cost one EventSource, not three.
 *
 * The payload is deliberately ignored here — every listener just refetches what
 * it shows, keeping the server the single authority on who sees what. A dropped
 * connection is EventSource's own problem: it reconnects automatically.
 */
type Listener = () => void

const listeners = new Set<Listener>()
let source: EventSource | null = null

function open(): void {
  // No EventSource (jsdom, SSR): callers still get their initial load + the slow
  // fallback poll, just no push. Never throw for the sake of a live update.
  if (source || typeof EventSource === 'undefined') return
  source = new EventSource('/api/events/stream', { withCredentials: true })
  // 'ping' keepalives arrive as their own event type and are ignored; only real
  // ticket changes carry the default/'ticket' type we react to.
  source.addEventListener('ticket', fire)
  source.onmessage = fire // default event, in case the server omits a type
}

function fire(): void {
  for (const l of listeners) l()
}

function close(): void {
  source?.close()
  source = null
}

/** Subscribe to ticket-change signals. Returns an unsubscribe function. */
export function subscribeTicketChanges(onChange: Listener): () => void {
  listeners.add(onChange)
  open()
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) close()
  }
}
