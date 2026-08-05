import { describe, it, expect } from 'vitest'
import { LoginThrottle } from './login-throttle'

const IP = '10.0.0.1'

describe('LoginThrottle — per-IP brute-force lockout (5 fails → 15 min)', () => {
  it('is not locked before any failures', () => {
    const th = new LoginThrottle()
    expect(th.isLocked(IP, 0)).toBe(false)
  })

  it('locks on the 5th consecutive failure and reports the trip', () => {
    const th = new LoginThrottle()
    for (let i = 0; i < 4; i++) expect(th.fail(IP, 0)).toBe(false)
    expect(th.fail(IP, 0)).toBe(true) // 5th trips the lock
    expect(th.isLocked(IP, 1)).toBe(true)
  })

  it('stays locked for 15 minutes, then frees up', () => {
    const th = new LoginThrottle()
    for (let i = 0; i < 5; i++) th.fail(IP, 0)
    expect(th.isLocked(IP, 15 * 60 * 1000 - 1)).toBe(true)
    expect(th.isLocked(IP, 15 * 60 * 1000 + 1)).toBe(false)
  })

  it('a success clears the counter', () => {
    const th = new LoginThrottle()
    th.fail(IP, 0)
    th.fail(IP, 0)
    th.succeed(IP)
    // counter reset → 4 more fails do not lock (would need 5 fresh)
    for (let i = 0; i < 4; i++) expect(th.fail(IP, 0)).toBe(false)
  })

  it('isolates IPs from each other', () => {
    const th = new LoginThrottle()
    for (let i = 0; i < 5; i++) th.fail(IP, 0)
    expect(th.isLocked('10.0.0.2', 1)).toBe(false)
  })
})
