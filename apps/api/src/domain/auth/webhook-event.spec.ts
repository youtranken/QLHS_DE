import { describe, it, expect } from 'vitest'
import { isKickEvent, parseWebhookEvent, WEBHOOK_STATUS_BY_EVENT } from './webhook-event'

describe('webhook-event', () => {
  it('classifies kick events', () => {
    expect(isKickEvent('user.locked')).toBe(true)
    expect(isKickEvent('user.deleted')).toBe(true)
    expect(isKickEvent('user.password_changed')).toBe(true)
    expect(isKickEvent('user.groups_changed')).toBe(false)
    expect(isKickEvent('user.logged_in')).toBe(false)
  })

  it('maps locked/deleted to a directory status', () => {
    expect(WEBHOOK_STATUS_BY_EVENT['user.locked']).toBe('locked')
    expect(WEBHOOK_STATUS_BY_EVENT['user.deleted']).toBe('deleted')
    expect(WEBHOOK_STATUS_BY_EVENT['user.password_changed']).toBeUndefined()
  })

  it('parses a valid event (wire user_id → userId)', () => {
    const e = parseWebhookEvent(JSON.stringify({ type: 'user.locked', user_id: 'sub-1', event_id: 'evt-1' }))
    expect(e).toEqual({ type: 'user.locked', userId: 'sub-1', groups: undefined, eventId: 'evt-1' })
  })

  it('parses groups when present', () => {
    const e = parseWebhookEvent(JSON.stringify({ type: 'user.groups_changed', user_id: 's', groups: ['a', 'b'] }))
    expect(e?.groups).toEqual(['a', 'b'])
  })

  it('returns null on malformed JSON or bad shape (→ caller answers 400, not 500)', () => {
    expect(parseWebhookEvent('{not json')).toBeNull()
    expect(parseWebhookEvent('"a string"')).toBeNull()
    expect(parseWebhookEvent(JSON.stringify({ type: 'x' }))).toBeNull() // missing user_id
    expect(parseWebhookEvent(JSON.stringify({ user_id: 's' }))).toBeNull() // missing type
    expect(parseWebhookEvent(JSON.stringify({ type: 'x', user_id: 's', groups: 'nope' }))).toBeNull()
    expect(parseWebhookEvent(JSON.stringify({ type: 'x', user_id: 's', event_id: 5 }))).toBeNull()
  })
})
