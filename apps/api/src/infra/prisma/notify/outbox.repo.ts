import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

/** Read side of the notification outbox (AD-15) — the mail-queue health number on
 *  the Admin overview. The dispatcher (Story 5.2) owns the writes. */
@Injectable()
export class OutboxRepo {
  constructor(private readonly prisma: PrismaService) {}

  pendingCount(): Promise<number> {
    return this.prisma.notificationOutbox.count({ where: { status: 'pending' } })
  }
}
