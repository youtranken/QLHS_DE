import { describe, it, expect, vi } from 'vitest'
import { FLOW, ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { PoolAutoReturnScheduler } from './pool-auto-return.scheduler'
import type { TicketState, TransitionOutput } from '../../domain/ticket/transition'

const NOW = new Date('2026-08-10T03:00:00.000Z') // Monday
const OVER_GRACE = new Date('2026-08-01T03:00:00.000Z') // >4 business days earlier
const FRESH = new Date('2026-08-10T03:00:00.000Z') // 0 business days

function make(tickets: Array<{ id: string; statusEnteredAt: Date }>) {
  const applied: Array<{ id: string; out: TransitionOutput }> = []
  const prisma = {
    ticket: { findMany: vi.fn().mockResolvedValue(tickets) },
    // The immediate return-notice enqueue (INSERT ... ON CONFLICT DO NOTHING).
    $executeRaw: vi.fn().mockResolvedValue(1),
  }
  const transitions = {
    apply: vi.fn(async (id: string, compute: (s: TicketState) => TransitionOutput) => {
      const state: TicketState = {
        id,
        status: TICKET_STATUS.Submitted,
        flow: FLOW.General,
        applicantSub: 'app-a',
        currentHolderSub: null,
        roundNo: 0,
        statusEnteredAt: OVER_GRACE,
      }
      const out = compute(state)
      applied.push({ id, out })
      return out.ticket
    }),
  }
  const clock = { now: () => NOW }
  const sched = new PoolAutoReturnScheduler(prisma as never, transitions as never, clock as never)
  return { sched, prisma, transitions, applied }
}

const RETURNED_KIND = 'Returned'

describe('PoolAutoReturnScheduler (4 business-day Pool grace)', () => {
  it('auto-returns only tickets over the grace window, via the system auto_return edge', async () => {
    const { sched, prisma, transitions, applied } = make([
      { id: 'old', statusEnteredAt: OVER_GRACE },
      { id: 'fresh', statusEnteredAt: FRESH },
    ])

    const count = await sched.scan()

    expect(count).toBe(1)
    expect(transitions.apply).toHaveBeenCalledTimes(1)
    expect(applied).toHaveLength(1)
    expect(applied[0]?.id).toBe('old')
    expect(applied[0]?.out.event.action).toBe(TICKET_EVENT.AutoReturn)
    expect(applied[0]?.out.ticket.status).toBe(TICKET_STATUS.ReturnFixing)
    expect(applied[0]?.out.event.actorSub).toBe('system')
    // The Applicant is notified immediately with the "Returned" notice (distinct
    // outbox key from the day-3 return-reminder backstop).
    // Tagged-template call: [strings, ticketId, roundNo, kind, recipientSub]
    // ('pending' is a SQL literal in the template, not an interpolated value).
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
    expect(prisma.$executeRaw.mock.calls[0]).toEqual(
      expect.arrayContaining(['old', RETURNED_KIND, 'app-a']),
    )
  })

  it('a concurrent pick (transition throws) is skipped, not fatal', async () => {
    const { sched, prisma, transitions } = make([{ id: 'old', statusEnteredAt: OVER_GRACE }])
    transitions.apply.mockRejectedValueOnce(new Error('No edge: Submitted to VP Andy'))

    await expect(sched.scan()).resolves.toBe(0)
    // No transition committed → no notice enqueued.
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('respects QLHS_POOL_AUTORETURN_DAYS override (grace not yet elapsed → none)', async () => {
    const prev = process.env.QLHS_POOL_AUTORETURN_DAYS
    process.env.QLHS_POOL_AUTORETURN_DAYS = '20'
    try {
      const { sched, transitions } = make([{ id: 'old', statusEnteredAt: OVER_GRACE }])
      expect(await sched.scan()).toBe(0)
      expect(transitions.apply).not.toHaveBeenCalled()
    } finally {
      if (prev === undefined) delete process.env.QLHS_POOL_AUTORETURN_DAYS
      else process.env.QLHS_POOL_AUTORETURN_DAYS = prev
    }
  })
})
