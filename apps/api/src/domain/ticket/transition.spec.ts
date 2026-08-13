import { describe, it, expect } from 'vitest'
import { FLOW, ROLE, SYSTEM_SUB, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import {
  transition,
  IllegalTransitionError,
  ForbiddenTransitionError,
  ReasonRequiredError,
  type TicketState,
} from './transition'

const NOW = new Date('2026-07-10T02:00:00.000Z')
const DCC1 = { sub: 'dcc1-a', activeRole: ROLE.Dcc1 }
const APPLICANT = { sub: 'app-a', activeRole: ROLE.Applicant }

function ticketAt(status: TicketState['status'], over: Partial<TicketState> = {}): TicketState {
  return {
    id: 't1',
    status,
    flow: FLOW.General,
    applicantSub: 'app-a',
    currentHolderSub: null,
    roundNo: 0,
    statusEnteredAt: new Date('2026-07-01T00:00:00.000Z'),
    ...over,
  }
}

describe('transition (AD-2 — the single status writer)', () => {
  it('applies a valid edge: status, holder, and exactly one audit row', () => {
    const t = ticketAt(TICKET_STATUS.Submitted, { currentHolderSub: null })
    const { ticket, event } = transition(t, {
      event: TICKET_EVENT.SubmitToAndy,
      actor: DCC1,
      now: NOW,
    })
    expect(ticket.status).toBe(TICKET_STATUS.SubmittedToVpAndy)
    expect(ticket.currentHolderSub).toBe('dcc1-a') // DCC1 owns Submitted to VP Andy
    expect(ticket.statusEnteredAt).toEqual(NOW)
    expect(event).toMatchObject({
      fromStatus: TICKET_STATUS.Submitted,
      toStatus: TICKET_STATUS.SubmittedToVpAndy,
      action: TICKET_EVENT.SubmitToAndy,
      actorSub: 'dcc1-a',
      roundNo: 0,
    })
  })

  it('auto-return (system) sends an un-picked Pool ticket straight to Return-fixing, no round bump', () => {
    const t = ticketAt(TICKET_STATUS.Submitted, { roundNo: 0, currentHolderSub: null })
    const { ticket, event } = transition(t, {
      event: TICKET_EVENT.AutoReturn,
      actor: { sub: 'system', activeRole: ROLE.Dcc1 },
      now: NOW,
      reason: 'Quá hạn tiếp nhận',
    })
    expect(ticket.status).toBe(TICKET_STATUS.ReturnFixing)
    expect(ticket.currentHolderSub).toBe('app-a') // Return-fixing is Applicant-owned
    expect(ticket.roundNo).toBe(0) // light bounce — ticket never entered a flow
    expect(event).toMatchObject({
      action: TICKET_EVENT.AutoReturn,
      actorSub: 'system',
      toStatus: TICKET_STATUS.ReturnFixing,
      reason: 'Quá hạn tiếp nhận',
    })
  })

  it('rejects an illegal edge without mutating anything', () => {
    const t = ticketAt(TICKET_STATUS.Submitted)
    expect(() => transition(t, { event: TICKET_EVENT.BopApprove, actor: DCC1, now: NOW })).toThrow(
      IllegalTransitionError,
    )
  })

  it('rejects an actor whose activeRole does not own the edge', () => {
    const t = ticketAt(TICKET_STATUS.Submitted)
    expect(() =>
      transition(t, { event: TICKET_EVENT.SubmitToAndy, actor: APPLICANT, now: NOW }),
    ).toThrow(ForbiddenTransitionError)
  })

  it('requires a reason for sendBack', () => {
    const t = ticketAt(TICKET_STATUS.SubmittedToVpAndy, { currentHolderSub: 'dcc1-a' })
    expect(() =>
      transition(t, { event: TICKET_EVENT.SendBack, actor: DCC1, now: NOW }),
    ).toThrow(ReasonRequiredError)
  })

  it('requires a reason for andyRequireBop (DCC1 records Andy\'s note to BOP)', () => {
    const t = ticketAt(TICKET_STATUS.SubmittedToVpAndy, { currentHolderSub: 'dcc1-a' })
    expect(() =>
      transition(t, { event: TICKET_EVENT.AndyRequireBop, actor: DCC1, now: NOW }),
    ).toThrow(ReasonRequiredError)
  })

  it('waives the mandatory reason for the SYSTEM actor (Skip Completed fast-forward)', () => {
    const t = ticketAt(TICKET_STATUS.ReceivedFromAcc, {
      flow: FLOW.Contract,
      currentHolderSub: 'dcc1-a',
    })
    const { ticket, event } = transition(t, {
      event: TICKET_EVENT.SubmitToBop,
      actor: { sub: SYSTEM_SUB, activeRole: ROLE.Dcc1 },
      now: NOW,
    })
    expect(ticket.status).toBe(TICKET_STATUS.SubmittedToBop)
    expect(event.reason).toBeUndefined()
  })

  it('andyRequireBop with a note advances to Submitted to BOP and records it', () => {
    const t = ticketAt(TICKET_STATUS.SubmittedToVpAndy, { currentHolderSub: 'dcc1-a' })
    const { ticket, event } = transition(t, {
      event: TICKET_EVENT.AndyRequireBop,
      actor: DCC1,
      now: NOW,
      reason: 'Sếp yêu cầu trình BOP',
    })
    expect(ticket.status).toBe(TICKET_STATUS.SubmittedToBop)
    expect(event.reason).toBe('Sếp yêu cầu trình BOP')
  })

  it('sendBack hands custody back to the applicant and records the reason', () => {
    const t = ticketAt(TICKET_STATUS.SubmittedToVpAndy, { currentHolderSub: 'dcc1-a' })
    const { ticket, event } = transition(t, {
      event: TICKET_EVENT.SendBack,
      actor: DCC1,
      now: NOW,
      reason: 'Thiếu chữ ký',
    })
    expect(ticket.status).toBe(TICKET_STATUS.Returned)
    expect(ticket.currentHolderSub).toBe('app-a')
    expect(event.reason).toBe('Thiếu chữ ký')
  })

  it('clears the holder on a terminal status (Completed)', () => {
    const t = ticketAt(TICKET_STATUS.SubmittedToVpAndy, { currentHolderSub: 'dcc1-a' })
    const { ticket } = transition(t, {
      event: TICKET_EVENT.AndyApproveComplete,
      actor: DCC1,
      now: NOW,
    })
    expect(ticket.status).toBe(TICKET_STATUS.Completed)
    expect(ticket.currentHolderSub).toBeNull()
  })

  // Round counting (AC4 / PRD §6): a round is counted only when the ticket had
  // already entered outside processing (ACC / DCC2-3 / BOP-after-ACC). The bump
  // happens AT the return (enteredFlow edge), not at resubmit.
  it('light sendBack (Andy reject, pre-ACC) does NOT bump round_no', () => {
    const t = ticketAt(TICKET_STATUS.SubmittedToVpAndy, { currentHolderSub: 'dcc1-a', roundNo: 0 })
    const { ticket, event } = transition(t, {
      event: TICKET_EVENT.SendBack,
      actor: DCC1,
      now: NOW,
      reason: 'Sai loại chứng từ',
    })
    expect(ticket.status).toBe(TICKET_STATUS.Returned)
    expect(ticket.roundNo).toBe(0)
    expect(event.roundNo).toBe(0)
  })

  it('heavy sendBack (ACC return) bumps round_no at return time', () => {
    const t = ticketAt(TICKET_STATUS.ReceivedFromAcc, {
      flow: FLOW.Contract,
      currentHolderSub: 'dcc1-a',
      roundNo: 0,
    })
    const { ticket, event } = transition(t, {
      event: TICKET_EVENT.SendBack,
      actor: DCC1,
      now: NOW,
      reason: 'ACC trả lại bản cứng sai',
    })
    expect(ticket.status).toBe(TICKET_STATUS.Returned)
    expect(ticket.roundNo).toBe(1)
    expect(event.roundNo).toBe(1)
  })

  it('resubmit carries the current round forward without re-bumping', () => {
    const t = ticketAt(TICKET_STATUS.ReturnFixing, { currentHolderSub: 'app-a', roundNo: 1 })
    const { ticket, event } = transition(t, {
      event: TICKET_EVENT.Resubmit,
      actor: APPLICANT,
      now: NOW,
    })
    expect(ticket.status).toBe(TICKET_STATUS.Submitted)
    expect(ticket.roundNo).toBe(1)
    expect(ticket.currentHolderSub).toBeNull() // back to Pool
    expect(event.roundNo).toBe(1)
  })

  it('DCC1 can send a pre-mint ticket back from Pool (Submitted)', () => {
    const t = ticketAt(TICKET_STATUS.Submitted, { currentHolderSub: 'dcc1-a', roundNo: 0 })
    const { ticket } = transition(t, {
      event: TICKET_EVENT.SendBack,
      actor: DCC1,
      now: NOW,
      reason: 'Sai loại chứng từ ngay khâu nhận',
    })
    expect(ticket.status).toBe(TICKET_STATUS.Returned)
    expect(ticket.currentHolderSub).toBe('app-a') // custody back to applicant
    expect(ticket.roundNo).toBe(0) // pre-mint = light, no round
  })
})
