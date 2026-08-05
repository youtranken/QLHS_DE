import { describe, it, expect } from 'vitest'
import { validateSync } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { TicketActionDto, BatchActionDto, ReasonDto, BATCH_MAX } from './ticket-action.dto'

function errorsFor<T extends object>(cls: new () => T, payload: object): string[] {
  return validateSync(plainToInstance(cls, payload)).flatMap((e) => Object.keys(e.constraints ?? {}))
}

describe('TicketActionDto / BatchActionDto — generic action whitelist', () => {
  it('accepts a genuine single-transition event', () => {
    expect(errorsFor(TicketActionDto, { event: 'andyApproveComplete' })).toEqual([])
  })

  // submitToAndy must NOT be fireable via the generic/batch action endpoint: only
  // /dcc1/pool/:id/confirm may perform Submitted→Andy because it mints the ticket
  // code (AD-5) and honours the soft-lock. Raw transition() does neither, so a
  // generic submitToAndy would advance a code-less ticket through to Completed.
  it('rejects submitToAndy on the single action endpoint', () => {
    expect(errorsFor(TicketActionDto, { event: 'submitToAndy' })).toContain('isIn')
  })

  it('rejects submitToAndy on the batch action endpoint', () => {
    expect(errorsFor(BatchActionDto, { ticketIds: ['t1'], event: 'submitToAndy' })).toContain('isIn')
  })

  // A batch bigger than BATCH_MAX would fan into that many concurrent FOR-UPDATE
  // transitions and exhaust the DB pool (insider DoS) — cap it at the edge.
  it('accepts a batch of exactly BATCH_MAX ids', () => {
    const ids = Array.from({ length: BATCH_MAX }, (_, i) => `t${i}`)
    expect(errorsFor(BatchActionDto, { ticketIds: ids, event: 'sendBack' })).toEqual([])
  })

  it('rejects a batch larger than BATCH_MAX', () => {
    const ids = Array.from({ length: BATCH_MAX + 1 }, (_, i) => `t${i}`)
    expect(errorsFor(BatchActionDto, { ticketIds: ids, event: 'sendBack' })).toContain('arrayMaxSize')
  })

  // `reason` is written verbatim into the immutable audit — reject oversized notes.
  it('rejects an over-long reason on the single, batch and reason-only DTOs', () => {
    const reason = 'x'.repeat(501)
    expect(errorsFor(TicketActionDto, { event: 'sendBack', reason })).toContain('maxLength')
    expect(errorsFor(BatchActionDto, { ticketIds: ['t1'], event: 'sendBack', reason })).toContain('maxLength')
    expect(errorsFor(ReasonDto, { reason })).toContain('maxLength')
  })
})
