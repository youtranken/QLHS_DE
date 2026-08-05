import { Injectable } from '@nestjs/common'
import { ALL_FLOWS } from '@qlhs/contracts'
import { AnalyticsRepo } from '../../infra/prisma/admin/analytics.repo'
import { TicketQueryRepo } from '../../infra/prisma/ticket/ticket-query.repo'
import { SlaRepo } from '../../infra/prisma/sla/sla.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { SlaClock, startOf } from '../sla/sla-clock'
import { makeThresholdOf } from '../../domain/admin/overview'
import { dwellHeatmapFromCells, type DwellRow } from '../../domain/analytics/dwell'
import { throughputFromBuckets, type ThroughputBucket } from '../../domain/analytics/throughput'
import { returnStatsFromRows, type ReturnStat } from '../../domain/analytics/return-rate'
import { topOverdue, type OverdueRanked } from '../../domain/analytics/overdue-rank'
import { type Granularity } from '../../domain/analytics/period'

export interface AnalyticsData {
  granularity: Granularity
  flows: string[]
  dwell: DwellRow[]
  throughput: ThroughputBucket[]
  returns: ReturnStat[]
  topOverdue: OverdueRanked[]
}

const TOP_OVERDUE = 10

/**
 * Management analytics, all derived at read (AD-6, no new tables): dwell heatmap,
 * throughput and return rate over the FULL audit history, plus the live top-overdue
 * list (pause-adjusted via SlaClock, same basis as every SLA badge). Admin-only.
 */
@Injectable()
export class GetAnalyticsUseCase {
  constructor(
    private readonly analytics: AnalyticsRepo,
    private readonly tickets: TicketQueryRepo,
    private readonly sla: SlaRepo,
    private readonly slaClock: SlaClock,
    private readonly clock: SystemClock,
  ) {}

  async execute(granularity: Granularity): Promise<AnalyticsData> {
    const now = this.clock.now()
    const flows = [...ALL_FLOWS]
    const [throughputRows, returnRows, dwellCells, ticketRows, slaRows] = await Promise.all([
      this.analytics.throughputBuckets(granularity),
      this.analytics.returnRows(),
      this.analytics.dwellCells(),
      this.tickets.listByFlows(flows),
      this.sla.list(),
    ])
    const thresholdOf = makeThresholdOf(slaRows)
    const clock = await this.slaClock.forRows(ticketRows, now)
    const overdueRows = ticketRows.map((t) => ({
      id: t.id,
      code: t.code,
      flow: t.flow,
      status: t.status,
      enteredAt: startOf(clock, t),
      holderSub: t.currentHolderSub,
    }))

    return {
      granularity,
      flows,
      dwell: dwellHeatmapFromCells(dwellCells, flows),
      throughput: throughputFromBuckets(throughputRows),
      returns: returnStatsFromRows(returnRows, flows),
      topOverdue: topOverdue(overdueRows, thresholdOf, now, TOP_OVERDUE),
    }
  }
}
