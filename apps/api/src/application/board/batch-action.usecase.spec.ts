import { describe, it, expect } from 'vitest'
import { BatchActionUseCase } from './batch-action.usecase'
import type { TransitionTicketUseCase } from '../core/transition-ticket.usecase'
import type { Actor } from '../../domain/ticket/transition'

const actor: Actor = { sub: 'dcc1', role: 'DCC1' } as unknown as Actor

/** A fake transition that records peak simultaneous in-flight calls. */
function trackingTransition(peak: { value: number }): TransitionTicketUseCase {
  let live = 0
  return {
    async execute({ ticketId }: { ticketId: string }) {
      live++
      peak.value = Math.max(peak.value, live)
      await new Promise((r) => setTimeout(r, 1))
      live--
      if (ticketId === 'boom') throw { code: 'IllegalTransition' }
      return { status: 'Returned' }
    },
  } as unknown as TransitionTicketUseCase
}

describe('BatchActionUseCase — bounded concurrency', () => {
  it('never runs more than 8 transitions at once, whatever the batch size', async () => {
    const peak = { value: 0 }
    const uc = new BatchActionUseCase(trackingTransition(peak))
    const ids = Array.from({ length: 50 }, (_, i) => `t${i}`)
    await uc.execute({ ticketIds: ids, event: 'sendBack' as never, actor })
    expect(peak.value).toBeLessThanOrEqual(8)
    expect(peak.value).toBeGreaterThan(1) // proves it does parallelise, not serial
  })

  it('returns one result per id, in input order, each ticket independent', async () => {
    const uc = new BatchActionUseCase(trackingTransition({ value: 0 }))
    const res = await uc.execute({ ticketIds: ['a', 'boom', 'c'], event: 'sendBack' as never, actor })
    expect(res.map((r) => r.id)).toEqual(['a', 'boom', 'c'])
    expect(res[0]).toMatchObject({ id: 'a', ok: true, status: 'Returned' })
    expect(res[1]).toMatchObject({ id: 'boom', ok: false, error: 'IllegalTransition' })
    expect(res[2]).toMatchObject({ id: 'c', ok: true })
  })
})
