import { describe, it, expect } from 'vitest'
import { intersectsCI, isGroupAllowed } from './group-access'

describe('intersectsCI — case-insensitive group match', () => {
  it('matches regardless of casing', () => {
    expect(intersectsCI(['QLHS-Users'], ['qlhs-users'])).toBe(true)
  })
  it('is false with no overlap', () => {
    expect(intersectsCI(['a', 'b'], ['c'])).toBe(false)
  })
  it('is false when either side is empty/undefined', () => {
    expect(intersectsCI([], ['a'])).toBe(false)
    expect(intersectsCI(undefined, ['a'])).toBe(false)
    expect(intersectsCI(['a'], [])).toBe(false)
  })
})

describe('isGroupAllowed — empty allow-list = gate OFF (fail-open)', () => {
  it('allows anyone when the allow-list is empty', () => {
    expect(isGroupAllowed(undefined, [])).toBe(true)
    expect(isGroupAllowed(['whatever'], [])).toBe(true)
  })
  it('allows only members of the allow-list once configured', () => {
    expect(isGroupAllowed(['qlhs-users'], ['QLHS-Users'])).toBe(true)
    expect(isGroupAllowed(['outsiders'], ['QLHS-Users'])).toBe(false)
    expect(isGroupAllowed(undefined, ['QLHS-Users'])).toBe(false)
  })
})
