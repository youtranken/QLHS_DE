import { describe, it, expect } from 'vitest'
import { loadEnv } from './env'

describe('loadEnv (fail-fast config)', () => {
  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/)
  })

  it('throws when DATABASE_URL is blank', () => {
    expect(() => loadEnv({ DATABASE_URL: '  ' })).toThrow(/DATABASE_URL/)
  })

  it('defaults PORT to 3000', () => {
    expect(loadEnv({ DATABASE_URL: 'postgres://x' }).PORT).toBe(3000)
  })

  it('rejects a non-numeric PORT', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgres://x', PORT: 'abc' })).toThrow(/PORT/)
  })

  it('rejects an out-of-range PORT', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgres://x', PORT: '99999' })).toThrow(/PORT/)
  })

  it('parses a valid PORT', () => {
    expect(loadEnv({ DATABASE_URL: 'postgres://x', PORT: '8080' })).toEqual({
      PORT: 8080,
      DATABASE_URL: 'postgres://x',
    })
  })
})
