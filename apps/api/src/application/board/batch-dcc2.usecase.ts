import { Injectable } from '@nestjs/common'
import { TICKET_EVENT } from '@qlhs/contracts'
import { ConfirmReceivedByDcc2UseCase } from '../handover/confirm-received-dcc2.usecase'
import { CompleteContractUseCase } from '../accounting/complete-contract.usecase'
import type { BatchResult } from './batch-action.usecase'

// Bound concurrent transitions like BatchActionUseCase — each per-ticket use case
// opens its own FOR-UPDATE transaction; unbounded fan-out would drain the pool.
const CONCURRENCY = 8

/**
 * Bulk DCC2 hardcopy actions (confirm-receipt / complete), each ticket independent.
 * Unlike the generic DCC1 batch, these route through the REAL per-ticket use cases —
 * confirm keeps the reconcile-flag guard, complete writes the Applicant email intent
 * (AD-15) — so bulk must NOT shortcut through a raw transition() that skips both.
 */
@Injectable()
export class BatchDcc2UseCase {
  constructor(
    private readonly confirmReceived: ConfirmReceivedByDcc2UseCase,
    private readonly completeContract: CompleteContractUseCase,
  ) {}

  async execute(req: { ticketIds: string[]; event: string; actorSub: string }): Promise<BatchResult[]> {
    const apply =
      req.event === TICKET_EVENT.CompleteContract
        ? (id: string) => this.completeContract.execute({ ticketId: id, actorSub: req.actorSub })
        : (id: string) => this.confirmReceived.execute({ ticketId: id, actorSub: req.actorSub })

    const results = new Array<BatchResult>(req.ticketIds.length)
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < req.ticketIds.length) {
        const i = next++
        const id = req.ticketIds[i]
        if (id === undefined) break
        try {
          const t = await apply(id)
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
