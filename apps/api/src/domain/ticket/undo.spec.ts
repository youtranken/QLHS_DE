import { describe, it, expect } from 'vitest'
import { FLOW, ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { transition, ForbiddenTransitionError, type TicketState } from './transition'
import { undoTransition, NotReversibleError } from './undo'

const NOW = new Date('2026-07-10T02:00:00.000Z')
const DCC1 = { sub: 'dcc1-a', activeRole: ROLE.Dcc1 }
const DCC2 = { sub: 'dcc2-b', activeRole: ROLE.Dcc2 }

function ticketAt(status: TicketState['status'], over: Partial<TicketState> = {}): TicketState {
  return {
    id: 't1',
    status,
    flow: FLOW.General,
    applicantSub: 'app-a',
    currentHolderSub: 'dcc1-a',
    roundNo: 0,
    statusEnteredAt: new Date('2026-07-01T00:00:00.000Z'),
    ...over,
  }
}

describe('reopen (FR-17 — Completed → Reopened → Returned, new round)', () => {
  it('reopens a Completed ticket then sends it back for a fresh round', () => {
    const completed = ticketAt(TICKET_STATUS.Completed, { currentHolderSub: null, roundNo: 0 })
    const reopened = transition(completed, { event: TICKET_EVENT.Reopen, actor: DCC1, now: NOW })
    expect(reopened.ticket.status).toBe(TICKET_STATUS.Reopened)
    expect(reopened.ticket.roundNo).toBe(0) // reopen itself does not count

    const returned = transition(reopened.ticket, {
      event: TICKET_EVENT.SendBack,
      actor: DCC1,
      now: NOW,
      reason: 'Sai số tiền, mở lại',
    })
    expect(returned.ticket.status).toBe(TICKET_STATUS.Returned)
    expect(returned.ticket.roundNo).toBe(1) // reopen path is heavy → counts
    expect(returned.ticket.currentHolderSub).toBe('app-a')
  })
})

describe('undoTransition (AD-19 — compensating, append-only)', () => {
  it('reverses a reversible move (andyRequireBop) back to the prior status', () => {
    const t = ticketAt(TICKET_STATUS.SubmittedToBop, { currentHolderSub: 'dcc1-a' })
    const out = undoTransition(
      t,
      { action: TICKET_EVENT.AndyRequireBop, fromStatus: TICKET_STATUS.SubmittedToVpAndy, occurredAt: NOW },
      DCC1,
      NOW,
    )
    expect(out.ticket.status).toBe(TICKET_STATUS.SubmittedToVpAndy)
    expect(out.event.action).toBe(TICKET_EVENT.Undo)
    expect(out.event.meta).toMatchObject({ undoneAction: TICKET_EVENT.AndyRequireBop })
  })

  it('restores the prior status_entered_at, not now — a bounce keeps the SLA clock', () => {
    // Ticket entered the restored station on 2026-07-05, bounced forward, then undone
    // at NOW. Undo must hand back the original entry time so an about-to-fire overdue
    // badge is not shed by the round-trip (the whole point of AD-19's compensation).
    const enteredAt = new Date('2026-07-05T00:00:00.000Z')
    const t = ticketAt(TICKET_STATUS.SubmittedToBop, { currentHolderSub: 'dcc1-a', statusEnteredAt: NOW })
    const out = undoTransition(
      t,
      {
        action: TICKET_EVENT.AndyRequireBop,
        fromStatus: TICKET_STATUS.SubmittedToVpAndy,
        occurredAt: NOW,
        priorStatusEnteredAt: enteredAt,
      },
      DCC1,
      NOW,
    )
    expect(out.ticket.statusEnteredAt).toEqual(enteredAt)
    expect(out.ticket.statusEnteredAt).not.toEqual(NOW)
  })

  it('refuses to undo an irreversible move (andyApproveComplete → Completed)', () => {
    const t = ticketAt(TICKET_STATUS.Completed, { currentHolderSub: null })
    expect(() =>
      undoTransition(
        t,
        { action: TICKET_EVENT.AndyApproveComplete, fromStatus: TICKET_STATUS.SubmittedToVpAndy, occurredAt: NOW },
        DCC1,
        NOW,
      ),
    ).toThrow(NotReversibleError)
  })

  it('refuses undo by an actor who does not own that edge (M1 — not just any role)', () => {
    // Reversible edges are DCC1-owned today; a DCC2 must not undo a DCC1 move even
    // though status + reversibility line up. Guards against a future DCC2/DCC3
    // reversible edge letting the wrong role reverse another role's action.
    const t = ticketAt(TICKET_STATUS.SubmittedToBop, { currentHolderSub: 'dcc1-a' })
    expect(() =>
      undoTransition(
        t,
        { action: TICKET_EVENT.AndyRequireBop, fromStatus: TICKET_STATUS.SubmittedToVpAndy, occurredAt: NOW },
        DCC2,
        NOW,
      ),
    ).toThrow(ForbiddenTransitionError)
  })

  it('refuses to undo when the ticket already moved on', () => {
    const t = ticketAt(TICKET_STATUS.Completed) // no longer at SubmittedToBop
    expect(() =>
      undoTransition(
        t,
        { action: TICKET_EVENT.AndyRequireBop, fromStatus: TICKET_STATUS.SubmittedToVpAndy, occurredAt: NOW },
        DCC1,
        NOW,
      ),
    ).toThrow(NotReversibleError)
  })
})
