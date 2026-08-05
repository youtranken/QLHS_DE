import { describe, expect, it, beforeEach } from 'vitest'
import { TICKET_STATUS } from '@qlhs/contracts'
import { PauseSlaUseCase, ResumeSlaUseCase } from './sla-pause.usecase'
import { NotHolderError, PauseReasonRequiredError, PauseStateError } from '../../domain/sla/pause-errors'

interface Row { id: string; currentHolderSub: string | null; status: string }

/** In-memory doubles for the two ports these use-cases touch (no DB in unit tests). */
class FakeTickets {
  constructor(private readonly rows: Row[]) {}
  findById(id: string) {
    return Promise.resolve(this.rows.find((r) => r.id === id) ?? null)
  }
}
class FakePauses {
  open: { ticketId: string; reason: string; pausedBySub: string; status?: string } | null = null
  resumed: { ticketId: string; resumedBySub: string } | null = null
  openFor(ticketId: string) {
    return Promise.resolve(this.open?.ticketId === ticketId ? this.open : null)
  }
  pause(ticketId: string, reason: string, pausedBySub: string, status: string) {
    this.open = { ticketId, reason, pausedBySub, status }
    return Promise.resolve()
  }
  resume(ticketId: string, resumedBySub: string) {
    if (this.open?.ticketId !== ticketId) return Promise.resolve(false)
    this.resumed = { ticketId, resumedBySub }
    this.open = null
    return Promise.resolve(true)
  }
}

const CLOCK = { now: () => new Date('2026-07-27T02:00:00.000Z') }

const HOLDER = 'dcc1-lan'
const TICKET: Row = { id: 't1', currentHolderSub: HOLDER, status: TICKET_STATUS.SubmittedToVpAndy }

describe('PauseSlaUseCase — only the person holding the ticket may stop its clock', () => {
  let pauses: FakePauses
  let pause: PauseSlaUseCase

  beforeEach(() => {
    pauses = new FakePauses()
    pause = new PauseSlaUseCase(new FakeTickets([TICKET]) as never, pauses as never)
  })

  it('records who paused it, why, and at which station', async () => {
    await pause.execute({ ticketId: 't1', actorSub: HOLDER, reason: 'Chờ nhà thầu ABC nộp bản gốc' })
    expect(pauses.open).toEqual({
      ticketId: 't1',
      reason: 'Chờ nhà thầu ABC nộp bản gốc',
      pausedBySub: HOLDER,
      // Captured now, not read back later: once resumed, the ticket moves on and
      // today's status would blame the wrong station in the Admin report.
      status: TICKET_STATUS.SubmittedToVpAndy,
    })
  })

  it('refuses someone who is not holding the ticket — a pause is not a way to help from afar', async () => {
    await expect(
      pause.execute({ ticketId: 't1', actorSub: 'dcc2-nam', reason: 'Chờ giấy' }),
    ).rejects.toBeInstanceOf(NotHolderError)
  })

  it('refuses a blank reason — an unexplained stopped clock is worse than a red badge', async () => {
    await expect(pause.execute({ ticketId: 't1', actorSub: HOLDER, reason: '   ' })).rejects.toBeInstanceOf(
      PauseReasonRequiredError,
    )
  })

  it('refuses to pause a ticket that is already paused (double-counting forgiven days)', async () => {
    await pause.execute({ ticketId: 't1', actorSub: HOLDER, reason: 'Chờ giấy' })
    await expect(pause.execute({ ticketId: 't1', actorSub: HOLDER, reason: 'Lại chờ' })).rejects.toBeInstanceOf(
      PauseStateError,
    )
  })

  it('refuses a ticket that is already closed — a finished ticket has no clock to stop', async () => {
    const closed = new PauseSlaUseCase(
      new FakeTickets([{ id: 't3', currentHolderSub: HOLDER, status: TICKET_STATUS.Completed }]) as never,
      pauses as never,
    )
    await expect(closed.execute({ ticketId: 't3', actorSub: HOLDER, reason: 'Chờ giấy' })).rejects.toBeInstanceOf(
      PauseStateError,
    )
  })

  it('refuses a ticket nobody is holding — an unheld ticket has no one to answer for the pause', async () => {
    const unheld = new PauseSlaUseCase(
      new FakeTickets([{ id: 't2', currentHolderSub: null, status: TICKET_STATUS.Submitted }]) as never,
      pauses as never,
    )
    await expect(unheld.execute({ ticketId: 't2', actorSub: HOLDER, reason: 'Chờ giấy' })).rejects.toBeInstanceOf(
      NotHolderError,
    )
  })
})

describe('ResumeSlaUseCase — restarting the clock', () => {
  let pauses: FakePauses
  let resume: ResumeSlaUseCase

  beforeEach(() => {
    pauses = new FakePauses()
    resume = new ResumeSlaUseCase(new FakeTickets([TICKET]) as never, pauses as never, CLOCK as never)
  })

  it('closes the open window and records who restarted it', async () => {
    pauses.open = { ticketId: 't1', reason: 'Chờ giấy', pausedBySub: HOLDER }
    await resume.execute({ ticketId: 't1', actorSub: HOLDER })
    expect(pauses.resumed).toEqual({ ticketId: 't1', resumedBySub: HOLDER })
    expect(pauses.open).toBeNull()
  })

  it('refuses to resume a ticket that was never paused', async () => {
    await expect(resume.execute({ ticketId: 't1', actorSub: HOLDER })).rejects.toBeInstanceOf(PauseStateError)
  })

  it('refuses a non-holder', async () => {
    pauses.open = { ticketId: 't1', reason: 'Chờ giấy', pausedBySub: HOLDER }
    await expect(resume.execute({ ticketId: 't1', actorSub: 'ai-do' })).rejects.toBeInstanceOf(NotHolderError)
  })
})
