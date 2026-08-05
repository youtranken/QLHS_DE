import { Injectable } from '@nestjs/common'
import type { Role } from '@qlhs/contracts'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { roleFlows } from '../../domain/dispatch/role-flows'
import { flowStations, displayStation } from '../../domain/ticket/route'
import { overdueDays } from '../../domain/sla/overdue'
import { SlaClock, startOf } from '../sla/sla-clock'
import { makeThresholdOf } from '../../domain/admin/overview'
import type { Flow, TicketStatus } from '@qlhs/contracts'

export interface StationNode {
  status: string
  count: number
  overdueCount: number
  overSla: boolean
}
export interface FlowLine {
  flow: string
  total: number
  stations: StationNode[]
}

/** Dispatch map: per-flow stations with counts + SLA flags, scoped to the role
 *  (AD-16), all derived at read (AD-6). Read-only. */
@Injectable()
export class DispatchMapUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly clock: SystemClock,
    private readonly slaClock: SlaClock,
  ) {}

  async execute(role: Role | null): Promise<FlowLine[]> {
    const flows = roleFlows(role)
    if (flows.length === 0) return []
    const now = this.clock.now()
    // Active work only — the Completed end-station is a marker, not a tally (the FE
    // draws it as ✓, never a number), so the map must NOT load the closed history
    // just to count a number nobody sees. Keeps the map flat as closed grows.
    const rows = await this.tickets.listActiveByFlows(flows as Flow[])
    const paused = await this.slaClock.forRows(rows, now)
    // One threshold snapshot for the whole map instead of a findUnique per station.
    const thresholdOf = makeThresholdOf(await this.sla.list())

    return flows.map((flow) => {
      const inFlow = rows.filter((r) => r.flow === flow)
      const stations = flowStations(flow).map((status: TicketStatus) => {
        // Active rows only, so the terminal Completed station resolves to 0 here.
        const at = inFlow.filter((r) => displayStation(flow as Flow, r.status as TicketStatus) === status)
        const threshold = thresholdOf(status, flow)
        const overdueCount = at.filter((r) => overdueDays(startOf(paused, r), threshold, now) > 0).length
        return { status, count: at.length, overdueCount, overSla: overdueCount > 0 }
      })
      return { flow, total: inFlow.length, stations }
    })
  }
}

export interface StationTicket {
  id: string
  code: string | null
  contractor: string | null
  flow: string
  overdueDays: number
}

/** Popover: tickets sitting at one station, within the role's flow scope. */
@Injectable()
export class StationTicketsUseCase {
  constructor(
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly clock: SystemClock,
    private readonly slaClock: SlaClock,
  ) {}

  async execute(status: string, role: Role | null, flow?: string): Promise<StationTicket[]> {
    const flows = roleFlows(role)
    if (flows.length === 0) return []
    // Scope to the clicked lane's flow when given (F2) — a shared station like the
    // unified Completed finish otherwise mixes tickets across flows. Ignore a flow
    // outside the role's scope (fall back to all its flows).
    const scoped = flow && flows.includes(flow as Flow) ? [flow as Flow] : flows
    const now = this.clock.now()
    // Payment's closed `Sent to Accounting` tickets are reachable under Completed.
    const rows = (await this.tickets.listByFlows(scoped)).filter(
      (r) => displayStation(r.flow as Flow, r.status as TicketStatus) === status,
    )
    const paused = await this.slaClock.forRows(rows, now)
    const thresholdOf = makeThresholdOf(await this.sla.list())
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      contractor: r.contractor,
      flow: r.flow,
      overdueDays: overdueDays(startOf(paused, r), thresholdOf(status, r.flow), now),
    }))
  }
}
