import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'

/** Idempotency ledger for PMH ID webhook deliveries (dedup replays/retries). */
@Injectable()
export class ProcessedWebhookEventRepo {
  constructor(private readonly prisma: PrismaService) {}

  async isProcessed(eventId: string): Promise<boolean> {
    const row = await this.prisma.processedWebhookEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    })
    return row !== null
  }

  /** INSERT ... ON CONFLICT DO NOTHING — safe under concurrent retries. */
  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.processedWebhookEvent.createMany({ data: [{ eventId }], skipDuplicates: true })
  }
}
