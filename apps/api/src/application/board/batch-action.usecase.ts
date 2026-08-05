import { Injectable } from '@nestjs/common'
import type { TicketEvent } from '@qlhs/contracts'
import { TransitionTicketUseCase } from '../core/transition-ticket.usecase'
import type { Actor } from '../../domain/ticket/transition'

export interface BatchResult {
  id: string
  ok: boolean
  status?: string
  error?: string
}

// Bound how many transitions run at once. Each opens a FOR-UPDATE transaction;
// unbounded Promise.all over a large batch would drain the Prisma pool and stall
// every other request. BatchActionDto also caps the batch size, so this is the
// second line of defence — worker pool keeps concurrent transactions ≤ this.
const CONCURRENCY = 8

/** Apply one action to many tickets; each ticket's fate is independent (FR-8/9). */
@Injectable()
export class BatchActionUseCase {
  constructor(private readonly transition: TransitionTicketUseCase) {}

  async execute(req: {
    ticketIds: string[]
    event: TicketEvent
    actor: Actor
    reason?: string
  }): Promise<BatchResult[]> {
    const results = new Array<BatchResult>(req.ticketIds.length)
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < req.ticketIds.length) {
        const i = next++
        const id = req.ticketIds[i]
        if (id === undefined) break
        results[i] = await this.one(id, req)
      }
    }
    const pool = Array.from({ length: Math.min(CONCURRENCY, req.ticketIds.length) }, worker)
    await Promise.all(pool)
    return results
  }

  private async one(
    id: string,
    req: { event: TicketEvent; actor: Actor; reason?: string },
  ): Promise<BatchResult> {
    try {
      const t = await this.transition.execute({
        ticketId: id,
        event: req.event,
        actor: req.actor,
        reason: req.reason,
      })
      return { id, ok: true, status: t.status }
    } catch (err) {
      return { id, ok: false, error: (err as { code?: string }).code ?? 'error' }
    }
  }
}
