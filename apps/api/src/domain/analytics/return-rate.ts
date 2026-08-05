import { TICKET_EVENT } from '@qlhs/contracts'
import { type AnalyticsEvent } from './types'

export interface ReturnStat {
  flow: string
  tickets: number
  returns: number
  /** returns per 100 distinct tickets seen in the window, rounded. */
  ratePct: number
}

/**
 * Return pressure per flow: how many SendBack events happened against how many
 * distinct tickets moved in the window. A ticket bounced twice counts as two
 * returns over one ticket, so the rate can exceed 100 — that is the signal, not
 * a bug (a flow whose files keep coming back).
 */
export function returnRateByFlow(events: readonly AnalyticsEvent[], flows: readonly string[]): ReturnStat[] {
  const ticketsByFlow = new Map<string, Set<string>>()
  const returnsByFlow = new Map<string, number>()
  for (const e of events) {
    let seen = ticketsByFlow.get(e.flow)
    if (!seen) {
      seen = new Set()
      ticketsByFlow.set(e.flow, seen)
    }
    seen.add(e.ticketId)
    if (e.action === TICKET_EVENT.SendBack) {
      returnsByFlow.set(e.flow, (returnsByFlow.get(e.flow) ?? 0) + 1)
    }
  }
  return flows.map((flow) => {
    const tickets = ticketsByFlow.get(flow)?.size ?? 0
    const returns = returnsByFlow.get(flow) ?? 0
    return { flow, tickets, returns, ratePct: tickets === 0 ? 0 : Math.round((returns / tickets) * 100) }
  })
}

/** Same output as returnRateByFlow but from pre-grouped per-flow rows (SQL counts
 *  distinct tickets + SendBacks). Zero-fills every flow in the given order. */
export function returnStatsFromRows(
  rows: readonly { flow: string; tickets: number; returns: number }[],
  flows: readonly string[],
): ReturnStat[] {
  const byFlow = new Map(rows.map((r) => [r.flow, r]))
  return flows.map((flow) => {
    const r = byFlow.get(flow)
    const tickets = r?.tickets ?? 0
    const returns = r?.returns ?? 0
    return { flow, tickets, returns, ratePct: tickets === 0 ? 0 : Math.round((returns / tickets) * 100) }
  })
}
