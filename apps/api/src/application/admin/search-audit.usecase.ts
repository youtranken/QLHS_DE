import { Injectable } from '@nestjs/common'
import { AuditRepo, type AuditFilters } from '../../infra/prisma/admin/audit.repo'
import { UserDirectoryRepo } from '../../infra/prisma/users/user-directory.repo'
import { SystemClock } from '../../infra/clock/system-clock'
import { pageWindow, totalPages } from '../../domain/admin/audit'

export interface AuditEventOut {
  id: string
  occurredAt: string
  actorSub: string
  actorName: string
  action: string
  code: string | null
  ticketId: string
  flow: string
  fromStatus: string
  toStatus: string
  reason: string | null
}

export interface AuditPage {
  events: AuditEventOut[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  today: Array<{ action: string; count: number }>
}

/**
 * Filtered, paginated read of the immutable audit (AD-4, read-only). Resolves
 * actor `sub` → display name (AD-12) and attaches a "today" per-event breakdown
 * for the sidebar. Admin-only surface (AD-7). Never writes ticket_event.
 */
@Injectable()
export class SearchAuditUseCase {
  constructor(
    private readonly audit: AuditRepo,
    private readonly directory: UserDirectoryRepo,
    private readonly clock: SystemClock,
  ) {}

  async execute(f: AuditFilters, page: number, pageSize = 25): Promise<AuditPage> {
    const win = pageWindow(page, pageSize)
    const { rows, total } = await this.audit.search(f, win.skip, win.take)

    const now = this.clock.now()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const [names, today] = await Promise.all([
      this.directory.namesForSubs([...new Set(rows.map((r) => r.actorSub))]),
      this.audit.statsSince(startOfDay),
    ])

    return {
      events: rows.map((r) => ({
        ...r,
        occurredAt: r.occurredAt.toISOString(),
        actorName: names[r.actorSub] ?? r.actorSub,
      })),
      total,
      page: win.page,
      pageSize: win.take,
      totalPages: totalPages(total, win.take),
      today,
    }
  }
}
