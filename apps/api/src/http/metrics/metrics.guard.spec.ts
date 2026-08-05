import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { MetricsGuard } from './metrics.guard'

// Fakes just enough of the Nest execution context to hand the guard an
// Authorization header.
function ctx(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  } as unknown as ExecutionContext
}

const ENV_KEYS = ['NODE_ENV', 'QLHS_METRICS_TOKEN'] as const

describe('MetricsGuard', () => {
  const guard = new MetricsGuard()
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  })
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('non-prod + no token → open (dev convenience)', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.QLHS_METRICS_TOKEN
    expect(guard.canActivate(ctx())).toBe(true)
  })

  it('prod + no token → fail-closed (denied)', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.QLHS_METRICS_TOKEN
    expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException)
  })

  it('prod + blank token → fail-closed (denied)', () => {
    process.env.NODE_ENV = 'production'
    process.env.QLHS_METRICS_TOKEN = '   '
    expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException)
  })

  it('prod + token + correct bearer → allowed', () => {
    process.env.NODE_ENV = 'production'
    process.env.QLHS_METRICS_TOKEN = 's3cret'
    expect(guard.canActivate(ctx('Bearer s3cret'))).toBe(true)
  })

  it('prod + token + wrong bearer → denied', () => {
    process.env.NODE_ENV = 'production'
    process.env.QLHS_METRICS_TOKEN = 's3cret'
    expect(() => guard.canActivate(ctx('Bearer nope'))).toThrow(UnauthorizedException)
  })

  it('prod + token + absent bearer → denied', () => {
    process.env.NODE_ENV = 'production'
    process.env.QLHS_METRICS_TOKEN = 's3cret'
    expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException)
  })
})
