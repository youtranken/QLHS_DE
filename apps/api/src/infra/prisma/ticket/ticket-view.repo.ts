import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

/**
 * Per-viewer "seen" state (AD-18). One row per (ticket, viewer sub); opening a
 * ticket upserts `last_viewed_at`. Server-side so it stays consistent across a
 * user's devices. The "unseen" badge is derived at read time (no stored flag).
 */
@Injectable()
export class TicketViewRepo {
  constructor(private readonly prisma: PrismaService) {}

  markViewed(ticketId: string, viewerSub: string, now: Date): Promise<unknown> {
    return this.prisma.ticketView.upsert({
      where: { ticketId_viewerSub: { ticketId, viewerSub } },
      update: { lastViewedAt: now },
      create: { ticketId, viewerSub, lastViewedAt: now },
    })
  }

  /** last_viewed_at for each of `ticketIds` this viewer has opened (missing = never). */
  async lastViewedMap(ticketIds: string[], viewerSub: string): Promise<Map<string, Date>> {
    if (ticketIds.length === 0) return new Map()
    const rows = await this.prisma.ticketView.findMany({
      where: { viewerSub, ticketId: { in: ticketIds } },
    })
    return new Map(rows.map((r) => [r.ticketId, r.lastViewedAt]))
  }
}
