import { describe, it, expect } from 'vitest'
import { messageForKind, relativeTime } from './notificationText'

const NOW = new Date('2026-07-27T10:00:00.000Z').getTime()
const ago = (min: number) => new Date(NOW - min * 60_000).toISOString()

describe('messageForKind', () => {
  it('maps a known kind to Vietnamese', () => {
    expect(messageForKind('Returned')).toBe('Hồ sơ bị trả lại — cần bổ sung')
  })
  it('falls back to the raw kind for an unknown one', () => {
    expect(messageForKind('Something New')).toBe('Something New')
  })
  it('reads the escalation tiers (2.5)', () => {
    expect(messageForKind('EscalateWarn')).toMatch(/sắp trễ/)
    expect(messageForKind('EscalateCritical')).toMatch(/quản trị/)
  })
})

describe('relativeTime', () => {
  it('reads "vừa xong" under a minute', () => {
    expect(relativeTime(ago(0), NOW)).toBe('vừa xong')
  })
  it('counts minutes, then hours, then days', () => {
    expect(relativeTime(ago(5), NOW)).toBe('5 phút trước')
    expect(relativeTime(ago(150), NOW)).toBe('2 giờ trước')
    expect(relativeTime(ago(60 * 24 * 3), NOW)).toBe('3 ngày trước')
  })
  it('never shows a negative time for a future stamp (clock skew)', () => {
    expect(relativeTime(new Date(NOW + 60_000).toISOString(), NOW)).toBe('vừa xong')
  })
})
