import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import type { PauseWindow } from '../../../domain/sla/pause'
import type { PauseRow as PauseReportRow } from '../../../domain/admin/pause-report'
import { PauseStateError } from '../../../domain/sla/pause-errors'

/** Prisma's unique-constraint code, without importing the Prisma error class. */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'
}

export interface TicketPause {
  pausedAt: Date
  resumedAt: Date | null
  reason: string
  pausedBySub: string
  status: string
}

export interface OpenPause {
  ticketId: string
  reason: string
  pausedBySub: string
  pausedAt: Date
}

/**
 * F8 pause windows. Reads are per-station: only windows opened since the ticket
 * entered its current status count, because `status_entered_at` already resets
 * the clock on every move — older windows belong to a station already left.
 */
@Injectable()
export class SlaPauseRepo {
  constructor(private readonly prisma: PrismaService) {}

  async openFor(ticketId: string): Promise<OpenPause | null> {
    const row = await this.prisma.ticketSlaPause.findFirst({
      where: { ticketId, resumedAt: null },
    })
    return row === null
      ? null
      : { ticketId, reason: row.reason, pausedBySub: row.pausedBySub, pausedAt: row.pausedAt }
  }

  async pause(ticketId: string, reason: string, pausedBySub: string, status: string): Promise<void> {
    try {
      await this.prisma.ticketSlaPause.create({ data: { ticketId, reason, pausedBySub, status } })
    } catch (e) {
      // Two requests raced past the openFor() check (double-click). The partial
      // unique index is the real guard; translate it so the caller sees the same
      // 409 as the sequential case instead of a 500 with a Prisma stack.
      if (isUniqueViolation(e)) {
        throw new PauseStateError('Hồ sơ đang ở trạng thái chờ bổ sung')
      }
      throw e
    }
  }

  /** Every pause opened since `since`, with the ticket's code/flow for display.
   *  Raw because `ticket_sla_pause` has no Prisma relation to `ticket` (the FK
   *  lives in SQL only) — one join beats loading both tables and stitching. */
  listForReport(since: Date): Promise<PauseReportRow[]> {
    return this.prisma.$queryRaw<PauseReportRow[]>`
      SELECT p.ticket_id AS "ticketId", t.code AS "code", p.status AS "status",
             t.flow AS "flow", p.reason AS "reason", p.paused_by_sub AS "pausedBySub",
             p.paused_at AS "pausedAt", p.resumed_at AS "resumedAt"
        FROM ticket_sla_pause p
        JOIN ticket t ON t.id = p.ticket_id
       WHERE p.paused_at >= ${since}
       ORDER BY p.paused_at DESC`
  }

  /** Every pause this ticket has ever had, oldest first — the detail page shows
   *  them so a reader can see why the clock stood still (F8 audit trace). */
  listForTicket(ticketId: string): Promise<TicketPause[]> {
    return this.prisma.ticketSlaPause.findMany({
      where: { ticketId },
      orderBy: { pausedAt: 'asc' },
      select: { pausedAt: true, resumedAt: true, reason: true, pausedBySub: true, status: true },
    })
  }

  /** Every clock still stopped, no matter how long ago it was stopped. */
  listOpen(): Promise<PauseReportRow[]> {
    return this.prisma.$queryRaw<PauseReportRow[]>`
      SELECT p.ticket_id AS "ticketId", t.code AS "code", p.status AS "status",
             t.flow AS "flow", p.reason AS "reason", p.paused_by_sub AS "pausedBySub",
             p.paused_at AS "pausedAt", p.resumed_at AS "resumedAt"
        FROM ticket_sla_pause p
        JOIN ticket t ON t.id = p.ticket_id
       WHERE p.resumed_at IS NULL
       ORDER BY p.paused_at ASC`
  }

  countOpen(): Promise<number> {
    return this.prisma.ticketSlaPause.count({ where: { resumedAt: null } })
  }

  /** Closes the open window at `now` (the caller's clock, so time-travel tests
   *  produce coherent windows). Returns false if nothing was open. */
  async resume(ticketId: string, resumedBySub: string, now: Date): Promise<boolean> {
    const { count } = await this.prisma.ticketSlaPause.updateMany({
      where: { ticketId, resumedAt: null },
      data: { resumedAt: now, resumedBySub },
    })
    return count > 0
  }

  /** Pause windows for many tickets at once, keyed by ticket id — one query for
   *  a whole board (a Pool of N cards must not cost N round-trips). */
  async windowsFor(entries: readonly { id: string; statusEnteredAt: Date }[]): Promise<Map<string, PauseWindow[]>> {
    const out = new Map<string, PauseWindow[]>()
    if (entries.length === 0) return out
    const rows = await this.prisma.ticketSlaPause.findMany({
      where: { ticketId: { in: entries.map((e) => e.id) } },
      select: { ticketId: true, pausedAt: true, resumedAt: true },
    })
    const enteredAt = new Map(entries.map((e) => [e.id, e.statusEnteredAt]))
    for (const r of rows) {
      const since = enteredAt.get(r.ticketId)
      if (!since || r.pausedAt < since) continue
      const list = out.get(r.ticketId) ?? []
      list.push({ from: r.pausedAt, to: r.resumedAt })
      out.set(r.ticketId, list)
    }
    return out
  }
}
