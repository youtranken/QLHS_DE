import { Injectable } from '@nestjs/common'
import { NotificationRepo } from '../../infra/prisma/notify/notification.repo'
import { isRead } from '../../domain/notify/notification-view'

const LIMIT = 30

export interface NotificationItem {
  id: string
  ticketId: string
  code: string | null
  kind: string
  createdAt: string
  read: boolean
}

export interface NotificationList {
  items: NotificationItem[]
  unread: number
}

/**
 * 2.2 — the bell's data. Lists the recent notifications addressed to a user (by
 * sub or by any of their roles) and derives read/unread at read time: personal
 * read marks plus role-inbox auto-resolve (isRead). No write, no stored counters.
 */
@Injectable()
export class ListNotificationsUseCase {
  constructor(private readonly repo: NotificationRepo) {}

  async execute(sub: string, roles: readonly string[]): Promise<NotificationList> {
    const rows = await this.repo.list(sub, roles, LIMIT)
    let unread = 0
    const items = rows.map((r) => {
      const read = isRead(r)
      if (!read) unread++
      return {
        id: r.id,
        ticketId: r.ticketId,
        code: r.code,
        kind: r.kind,
        createdAt: r.createdAt.toISOString(),
        read,
      }
    })
    return { items, unread }
  }
}
