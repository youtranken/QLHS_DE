import { Injectable } from '@nestjs/common'
import { ConfirmReceivedByDcc3UseCase } from '../handover/confirm-received-dcc3.usecase'
import type { BatchResult } from './batch-action.usecase'

// Bound concurrent transitions like the other batch use cases.
const CONCURRENCY = 8

/**
 * Bulk DCC3 hardcopy confirm-receipt (Payment). Symmetric to BatchDcc2UseCase but
 * confirm-only: Payment has no "complete" step (it closes later at send-to-ACC via
 * the per-ticket batch sheet). Routes through the real per-ticket use case so the
 * reconcile-flag guard + receipt date are preserved.
 */
@Injectable()
export class BatchDcc3UseCase {
  constructor(private readonly confirmReceived: ConfirmReceivedByDcc3UseCase) {}

  async execute(req: { ticketIds: string[]; actorSub: string }): Promise<BatchResult[]> {
    const results = new Array<BatchResult>(req.ticketIds.length)
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < req.ticketIds.length) {
        const i = next++
        const id = req.ticketIds[i]
        if (id === undefined) break
        try {
          const t = await this.confirmReceived.execute({ ticketId: id, actorSub: req.actorSub })
          results[i] = { id, ok: true, status: t.status }
        } catch (err) {
          results[i] = { id, ok: false, error: (err as { code?: string }).code ?? 'error' }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, req.ticketIds.length) }, worker))
    return results
  }
}
