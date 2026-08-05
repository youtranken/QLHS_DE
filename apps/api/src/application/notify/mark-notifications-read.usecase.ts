import { Injectable } from '@nestjs/common'
import { NotificationRepo } from '../../infra/prisma/notify/notification.repo'

/** 2.2 — clear the bell, all of it or one item. Only marks notifications the
 *  caller is actually addressed by (enforced in the repo), so a guessed id is
 *  a no-op rather than a stray read row. */
@Injectable()
export class MarkNotificationsReadUseCase {
  constructor(private readonly repo: NotificationRepo) {}

  markAll(sub: string, roles: readonly string[]): Promise<void> {
    return this.repo.markAllRead(sub, roles).then(() => undefined)
  }

  markOne(sub: string, roles: readonly string[], id: string): Promise<void> {
    return this.repo.markOneRead(sub, roles, id).then(() => undefined)
  }
}
