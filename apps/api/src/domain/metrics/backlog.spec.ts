import { describe, it, expect } from 'vitest'
import { evaluateBacklog, type BacklogCounts, type BacklogConfig } from './backlog'

const cfg: BacklogConfig = { pendingWarn: 20, pendingCritical: 100 }
const counts = (over: Partial<BacklogCounts> = {}): BacklogCounts => ({
  mailPending: 0,
  mailFailed: 0,
  digestPending: 0,
  digestFailed: 0,
  ...over,
})

describe('evaluateBacklog', () => {
  it('is ok when every queue is drained', () => {
    expect(evaluateBacklog(counts(), cfg).level).toBe('ok')
  })

  it('warns once pending crosses the warn threshold', () => {
    const r = evaluateBacklog(counts({ mailPending: 20 }), cfg)
    expect(r.level).toBe('warn')
    expect(r.breached).toContain('mailPending')
  })

  it('escalates to critical past the critical threshold', () => {
    expect(evaluateBacklog(counts({ mailPending: 100 }), cfg).level).toBe('critical')
  })

  it('treats ANY parked failure as critical — a lost mail is not a backlog blip', () => {
    const r = evaluateBacklog(counts({ mailFailed: 1 }), cfg)
    expect(r.level).toBe('critical')
    expect(r.breached).toContain('mailFailed')
  })

  it('reports the digest queue independently of the ticket queue', () => {
    const r = evaluateBacklog(counts({ digestFailed: 2 }), cfg)
    expect(r.level).toBe('critical')
    expect(r.breached).toContain('digestFailed')
  })

  it('names every breached queue in the message', () => {
    const r = evaluateBacklog(counts({ mailPending: 30, digestFailed: 1 }), cfg)
    expect(r.message).toMatch(/mailPending=30/)
    expect(r.message).toMatch(/digestFailed=1/)
  })
})
