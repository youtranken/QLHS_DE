import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

export interface AuditEvent {
  id: string
  occurredAt: Date
  actorSub: string
  action: string
  ticketId: string
  code: string | null
  flow: string
  fromStatus: string
  toStatus: string
  reason: string | null
}

interface EventRow {
  id: bigint
  occurredAt: Date
  actorSub: string
  action: string
  ticketId: string
  fromStatus: string
  toStatus: string
  reason: string | null
  ticket: { code: string | null; flow: string }
}

function toAuditEvent(r: EventRow): AuditEvent {
  return {
    id: r.id.toString(),
    occurredAt: r.occurredAt,
    actorSub: r.actorSub,
    action: r.action,
    ticketId: r.ticketId,
    code: r.ticket.code,
    flow: r.ticket.flow,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    reason: r.reason,
  }
}

/**
 * Read-only window onto the immutable audit (AD-4). `ticket_event` is append-only
 * — GRANT is INSERT+SELECT and the sole writer is transition(); this repo NEVER
 * writes. Used by the Admin overview (recent activity) and the audit log viewer.
 */
@Injectable()
export class AuditRepo {
  constructor(private readonly prisma: PrismaService) {}

  countSince(since: Date): Promise<number> {
    return this.prisma.ticketEvent.count({ where: { occurredAt: { gte: since } } })
  }

  async recent(limit: number): Promise<AuditEvent[]> {
    const rows = (await this.prisma.ticketEvent.findMany({
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { ticket: { select: { code: true, flow: true } } },
    })) as unknown as EventRow[]
    return rows.map(toAuditEvent)
  }

  /** Filtered, paginated audit window (newest first) + a total for the pager. */
  async search(f: AuditFilters, skip: number, take: number): Promise<{ rows: AuditEvent[]; total: number }> {
    const where = buildWhere(f)
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ticketEvent.findMany({
        where,
        // id desc breaks occurredAt ties → stable pagination (no dup/skip), M3.
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: { ticket: { select: { code: true, flow: true } } },
      }),
      this.prisma.ticketEvent.count({ where }),
    ])
    return { rows: (rows as unknown as EventRow[]).map(toAuditEvent), total }
  }

  /** Per-event counts since a moment (the "Hôm nay" sidebar), busiest first. */
  async statsSince(since: Date): Promise<Array<{ action: string; count: number }>> {
    const grouped = await this.prisma.ticketEvent.groupBy({
      by: ['action'],
      where: { occurredAt: { gte: since } },
      _count: { action: true },
    })
    return grouped
      .map((g) => ({ action: g.action, count: g._count.action }))
      .sort((a, b) => b.count - a.count)
  }
}

export interface AuditFilters {
  code?: string
  actorSub?: string
  event?: string
  from?: Date
  to?: Date
}

function buildWhere(f: AuditFilters) {
  const contains = (v?: string) =>
    v && v.trim() ? { contains: v.trim(), mode: 'insensitive' as const } : undefined
  const range = f.from || f.to ? { gte: f.from ?? undefined, lte: f.to ?? undefined } : undefined
  const event = f.event && f.event.trim() ? f.event.trim() : undefined
  const code = contains(f.code)
  return {
    action: event,
    actorSub: contains(f.actorSub),
    occurredAt: range,
    ticket: code ? { code } : undefined,
  }
}
