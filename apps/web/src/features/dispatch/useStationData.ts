import { useCallback, useRef, useState } from 'react'
import { getDispatchMap, getStationTickets, type FlowLine, type StationTicket } from './api'
import { useLiveRefetch } from '../../shared/useLiveRefetch'
import { t } from '../../i18n'

/** Nguồn dữ liệu bản đồ điều độ: refetch theo SSE (2.1) + nạp hồ sơ từng ga theo
 *  yêu cầu (cache trong 1 chu kỳ để hover không gọi API lặp). */
export function useStationData() {
  const [lines, setLines] = useState<FlowLine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cache = useRef(new Map<string, StationTicket[]>())

  // Keep the last-good map on a failed refetch; the error box only shows before
  // anything loaded (same contract as the board / MyTickets).
  const load = useCallback(async () => {
    try {
      setLines(await getDispatchMap())
      cache.current.clear()
      setError(null)
      setLoaded(true)
    } catch {
      setError(t('dispatch.loadErr'))
    }
  }, [])

  useLiveRefetch(() => void load())

  // Throws on failure — the caller (hover/open) decides whether to surface it.
  // Cache key includes flow: a shared station (e.g. Completed) differs per lane (F2).
  const ticketsOf = useCallback(async (status: string, flow: string): Promise<StationTicket[]> => {
    const key = `${flow}::${status}`
    const hit = cache.current.get(key)
    if (hit) return hit
    const tickets = await getStationTickets(status, flow)
    cache.current.set(key, tickets)
    return tickets
  }, [])

  return { lines, ticketsOf, loaded, error, reload: load }
}
