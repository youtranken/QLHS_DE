import { describe, expect, it } from 'vitest'
import { isRead } from './notification-view'

describe('isRead — personal read + role-inbox auto-resolve', () => {
  it('is read once the person explicitly read it', () => {
    expect(isRead({ readByMe: true, waitingStatus: null, ticketStatus: 'Returned' })).toBe(true)
  })

  it('a personal notification stays unread until read — it never auto-resolves', () => {
    expect(isRead({ readByMe: false, waitingStatus: null, ticketStatus: 'Completed' })).toBe(false)
  })

  it('a role-inbox note is unread while the ticket still sits at that station', () => {
    expect(
      isRead({ readByMe: false, waitingStatus: 'Submitted to DCC2', ticketStatus: 'Submitted to DCC2' }),
    ).toBe(false)
  })

  it('a role-inbox note auto-resolves once someone moves the ticket on', () => {
    // DCC-A received it → status advanced → DCC-B and C are no longer owed it.
    expect(
      isRead({ readByMe: false, waitingStatus: 'Submitted to DCC2', ticketStatus: 'Received by DCC2' }),
    ).toBe(true)
  })

  it('treats a vanished ticket as resolved rather than eternally unread', () => {
    expect(isRead({ readByMe: false, waitingStatus: 'Submitted', ticketStatus: null })).toBe(true)
  })

  it('an explicit read mark wins even before the ticket moves', () => {
    expect(
      isRead({ readByMe: true, waitingStatus: 'Submitted to DCC3', ticketStatus: 'Submitted to DCC3' }),
    ).toBe(true)
  })
})
