import { describe, it, expect } from 'vitest'
import { throttleDisabled } from './throttle-flag'

describe('throttleDisabled — test-only kill-switch, inert in prod', () => {
  it('disables throttling when the flag is set outside production', () => {
    expect(throttleDisabled({ QLHS_DISABLE_THROTTLE: '1', NODE_ENV: 'test' })).toBe(true)
    expect(throttleDisabled({ QLHS_DISABLE_THROTTLE: '1', NODE_ENV: 'development' })).toBe(true)
    expect(throttleDisabled({ QLHS_DISABLE_THROTTLE: '1' })).toBe(true)
  })

  it('is INERT in production even if the flag leaks into the env', () => {
    expect(throttleDisabled({ QLHS_DISABLE_THROTTLE: '1', NODE_ENV: 'production' })).toBe(false)
  })

  it('leaves throttling on when the flag is absent', () => {
    expect(throttleDisabled({ NODE_ENV: 'development' })).toBe(false)
    expect(throttleDisabled({})).toBe(false)
  })
})
