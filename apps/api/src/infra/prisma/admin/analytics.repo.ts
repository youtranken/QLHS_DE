import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { PrismaService } from '../prisma.service'
import { type ThroughputBucket } from '../../../domain/analytics/throughput'
import { type DwellCellAgg } from '../../../domain/analytics/dwell'

export interface ReturnRow {
  flow: string
  tickets: number
  returns: number
}

export interface ExportRow {
  occurredAt: Date
  code: string | null
  flow: string
  action: string
  fromStatus: string
  toStatus: string
  actorSub: string
  reason: string | null
}

/**
 * Read-only projection of the immutable audit for analytics (AD-4/AD-6 — derived
 * at read, no new tables). Dwell/throughput/return-rate aggregate the FULL event
 * history IN POSTGRES (GROUP BY / a per-ticket LAG window) instead of streaming
 * every row into Node — the audit grows without bound, so the old full-table load
 * was the one unbounded read. The pure functions remain the tested contract; the
 * admin-analytics e2e asserts these queries agree with them. The dated CSV export
 * is the only row-level read, and it is already windowed.
 *
 * Civil-period bucketing is on Asia/Ho_Chi_Minh to match domain/analytics/period.
 */
@Injectable()
export class AnalyticsRepo {
  constructor(private readonly prisma: PrismaService) {}

  /** Created vs cleared per civil week/month (mirrors throughputByPeriod). */
  async throughputBuckets(granularity: 'week' | 'month'): Promise<ThroughputBucket[]> {
    // occurred_at is `timestamp` holding UTC wall time (Prisma). Read it back AS
    // UTC, then convert to the Asia/Ho_Chi_Minh civil calendar — matches period.ts.
    const civil = Prisma.sql`(te.occurred_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')`
    const period =
      granularity === 'month'
        ? Prisma.sql`to_char(${civil}, 'YYYY-MM')`
        : Prisma.sql`to_char(date_trunc('week', ${civil}), 'YYYY-MM-DD')`
    return this.prisma.$queryRaw<ThroughputBucket[]>(Prisma.sql`
      SELECT ${period} AS period,
             COUNT(*) FILTER (WHERE te.action = ${TICKET_EVENT.Created})::int AS created,
             COUNT(*) FILTER (WHERE te.to_status IN (${TICKET_STATUS.Completed}, ${TICKET_STATUS.SentToAccounting}))::int AS completed
      FROM ticket_event te
      GROUP BY period
    `)
  }

  /** Distinct tickets moved + SendBacks per flow (mirrors returnRateByFlow). */
  async returnRows(): Promise<ReturnRow[]> {
    return this.prisma.$queryRaw<ReturnRow[]>(Prisma.sql`
      SELECT t.flow AS flow,
             COUNT(DISTINCT te.ticket_id)::int AS tickets,
             COUNT(*) FILTER (WHERE te.action = ${TICKET_EVENT.SendBack})::int AS "returns"
      FROM ticket_event te JOIN ticket t ON t.id = te.ticket_id
      GROUP BY t.flow
    `)
  }

  /** Per-(status, flow) dwell totals via a per-ticket LAG window: the gap between
   *  consecutive events is attributed to the prior to-status (mirrors dwellSegments;
   *  zero/negative gaps dropped). Sums time in Node's ms units. */
  async dwellCells(): Promise<DwellCellAgg[]> {
    return this.prisma.$queryRaw<DwellCellAgg[]>(Prisma.sql`
      WITH ev AS (
        SELECT t.flow AS flow, te.to_status AS to_status, te.occurred_at AS occurred_at,
               LAG(te.occurred_at) OVER w AS prev_at,
               LAG(te.to_status)   OVER w AS prev_to
        FROM ticket_event te JOIN ticket t ON t.id = te.ticket_id
        WINDOW w AS (PARTITION BY te.ticket_id ORDER BY te.occurred_at, te.id)
      )
      SELECT prev_to AS status, flow,
             COUNT(*)::int AS count,
             SUM(EXTRACT(EPOCH FROM (occurred_at - prev_at)) * 1000)::float8 AS "totalMs"
      FROM ev
      WHERE prev_at IS NOT NULL AND occurred_at > prev_at
      GROUP BY prev_to, flow
    `)
  }

  async exportRows(from: Date, to: Date): Promise<ExportRow[]> {
    const rows = (await this.prisma.ticketEvent.findMany({
      where: { occurredAt: { gte: from, lte: to } },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: {
        occurredAt: true,
        action: true,
        fromStatus: true,
        toStatus: true,
        actorSub: true,
        reason: true,
        ticket: { select: { code: true, flow: true } },
      },
    })) as unknown as Array<{
      occurredAt: Date
      action: string
      fromStatus: string
      toStatus: string
      actorSub: string
      reason: string | null
      ticket: { code: string | null; flow: string }
    }>
    return rows.map((r) => ({
      occurredAt: r.occurredAt,
      code: r.ticket.code,
      flow: r.ticket.flow,
      action: r.action,
      fromStatus: r.fromStatus,
      toStatus: r.toStatus,
      actorSub: r.actorSub,
      reason: r.reason,
    }))
  }
}
