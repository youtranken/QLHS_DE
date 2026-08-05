import { describe, it, expect } from 'vitest'
import { isExpired, heldByOther, LOCK_TTL_MS, type TicketLock } from './lock'

const NOW = new Date('2026-07-10T02:00:00.000Z')

function lock(over: Partial<TicketLock> = {}): TicketLock {
  return {
    ticketId: 't1',
    holderSub: 'dcc1-a',
    acquiredAt: new Date(NOW.getTime() - 60_000),
    expiresAt: new Date(NOW.getTime() + LOCK_TTL_MS),
    ...over,
  }
}

describe('soft lock (AD-9)', () => {
  it('is not expired before its TTL', () => {
    expect(isExpired(lock(), NOW)).toBe(false)
  })

  it('is expired at/after expiresAt', () => {
    expect(isExpired(lock({ expiresAt: NOW }), NOW)).toBe(true)
    expect(isExpired(lock({ expiresAt: new Date(NOW.getTime() - 1) }), NOW)).toBe(true)
  })

  it('heldByOther: true when a live lock belongs to someone else', () => {
    expect(heldByOther(lock({ holderSub: 'dcc1-b' }), NOW, 'dcc1-a')).toBe(true)
  })

  it('heldByOther: false for the holder, an expired lock, or no lock', () => {
    expect(heldByOther(lock({ holderSub: 'dcc1-a' }), NOW, 'dcc1-a')).toBe(false)
    expect(heldByOther(lock({ holderSub: 'dcc1-b', expiresAt: NOW }), NOW, 'dcc1-a')).toBe(false)
    expect(heldByOther(null, NOW, 'dcc1-a')).toBe(false)
  })
})
