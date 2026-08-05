import { useEffect } from 'react'
import { subscribeTicketChanges } from './ticketStream'

/** Coalesce a burst of changes (a handover fires several in a row) into one refetch. */
const DEBOUNCE_MS = 250
// Belt-and-suspenders: if the SSE stream dies silently behind a proxy, this still
// catches up — but at 30s, not the old 4s hammering.
const FALLBACK_MS = 30_000

/**
 * 2.1 — replaces the per-view `setInterval(load, 4000)`. Loads once, then
 * refetches whenever the server signals a ticket change (debounced), with a slow
 * safety poll as a fallback. `deps` re-runs the initial load (e.g. a manual
 * reload key) exactly like the effect it replaces.
 */
export function useLiveRefetch(load: () => void, deps: readonly unknown[] = []): void {
  useEffect(() => {
    load()
    let timer: ReturnType<typeof setTimeout> | null = null
    const refetch = () => {
      if (timer) return
      timer = setTimeout(() => {
        timer = null
        load()
      }, DEBOUNCE_MS)
    }
    const unsubscribe = subscribeTicketChanges(refetch)
    const fallback = setInterval(load, FALLBACK_MS)
    return () => {
      unsubscribe()
      clearInterval(fallback)
      if (timer) clearTimeout(timer)
    }
    // `load` is intentionally not a dep — callers pass a stable useCallback; the
    // effect re-runs only on the explicit `deps` (a manual reload key).
  }, deps)
}
