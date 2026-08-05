import { describe, it, expect } from 'vitest'
import { SessionStore, SESSION_MAX_AGE_MS } from './session.store'

const base = { sub: 'u1', groups: [], roles: [], activeRole: null }

describe('SessionStore', () => {
  it('creates and returns a live session', () => {
    const store = new SessionStore()
    const id = store.create(base, 1000)
    expect(store.get(id, 1000)?.sub).toBe('u1')
  })

  it('expires a session past the absolute max age (fail closed)', () => {
    const store = new SessionStore()
    const id = store.create(base, 0)
    expect(store.get(id, SESSION_MAX_AGE_MS)).toBeDefined() // exactly at cap = still valid
    expect(store.get(id, SESSION_MAX_AGE_MS + 1)).toBeUndefined()
    // a second get confirms the expired session was evicted, not just hidden
    expect(store.get(id, 0)).toBeUndefined()
  })

  it('deleteBySub kills every session of a user', () => {
    const store = new SessionStore()
    store.create({ ...base, sub: 'x' }, 0)
    store.create({ ...base, sub: 'x' }, 0)
    store.create({ ...base, sub: 'y' }, 0)
    expect(store.deleteBySub('x')).toBe(2)
  })
})
