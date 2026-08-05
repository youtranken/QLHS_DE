import { describe, it, expect } from 'vitest'
import { isUnseen } from './unseen'

const H = 3600_000
const now = new Date('2026-07-12T12:00:00Z')

describe('isUnseen (Story 5.3 — derived >24h signal, AD-18/AD-6)', () => {
  it('a never-viewed ticket is unseen only after 24h since it arrived (AC4)', () => {
    expect(isUnseen(null, new Date(now.getTime() - 25 * H), now)).toBe(true)
    expect(isUnseen(null, new Date(now.getTime() - 2 * H), now)).toBe(false)
  })

  it('a viewed ticket is unseen only >24h after the last view (AC2)', () => {
    expect(isUnseen(new Date(now.getTime() - 25 * H), new Date(0), now)).toBe(true)
    expect(isUnseen(new Date(now.getTime() - 23 * H), new Date(0), now)).toBe(false)
  })

  it('the last view wins over the arrival time (a recent view clears the signal)', () => {
    const longAgo = new Date(now.getTime() - 100 * H)
    expect(isUnseen(new Date(now.getTime() - 1 * H), longAgo, now)).toBe(false)
  })

  it('exactly 24h is not yet unseen (strict >)', () => {
    expect(isUnseen(new Date(now.getTime() - 24 * H), new Date(0), now)).toBe(false)
  })
})
