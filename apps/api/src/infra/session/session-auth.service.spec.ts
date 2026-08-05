import { describe, it, expect, vi } from 'vitest'
import { SessionStore, SESSION_MAX_AGE_MS } from './session.store'
import { SessionAuthService } from './session-auth.service'
import type { TokenSet } from '../../domain/auth/identity.port'

const base = { sub: 'u1', groups: [], roles: [], activeRole: null }

function tokens(patch: Partial<TokenSet> = {}): TokenSet {
  return { accessToken: 'a', refreshToken: 'r2', expiresAt: 10_000, ...patch }
}

/** Fake identity exposing only refresh() — the single OIDC call resolve() makes. */
function fakeIdentity(refresh: (t: string) => Promise<TokenSet>) {
  return { refresh: vi.fn(refresh) }
}

describe('SessionAuthService.resolve', () => {
  it('returns a live SSO session unchanged and does NOT refresh', async () => {
    const store = new SessionStore()
    const id = store.create({ ...base, refreshToken: 'r1', accessExpiresAt: 5_000 }, 0)
    const idn = fakeIdentity(async () => tokens())
    const svc = new SessionAuthService(store, idn)

    const s = await svc.resolve(id, 4_000) // now < accessExpiresAt
    expect(s?.sub).toBe('u1')
    expect(idn.refresh).not.toHaveBeenCalled()
  })

  it('returns a local-SA session (no accessExpiresAt) without refreshing', async () => {
    const store = new SessionStore()
    const id = store.create(base, 0) // no token fields — break-glass SA
    const idn = fakeIdentity(async () => tokens())
    const svc = new SessionAuthService(store, idn)

    const s = await svc.resolve(id, 60_000)
    expect(s?.sub).toBe('u1')
    expect(idn.refresh).not.toHaveBeenCalled()
  })

  it('silently refreshes an expired access token and updates the session', async () => {
    const store = new SessionStore()
    const id = store.create({ ...base, refreshToken: 'r1', accessExpiresAt: 5_000 }, 0)
    const idn = fakeIdentity(async () => tokens({ refreshToken: 'r2', expiresAt: 99_000 }))
    const svc = new SessionAuthService(store, idn)

    const s = await svc.resolve(id, 6_000) // now > accessExpiresAt
    expect(idn.refresh).toHaveBeenCalledWith('r1')
    expect(s?.accessExpiresAt).toBe(99_000)
    // rotated refresh token is persisted for the next cycle
    expect(store.get(id, 6_000)?.refreshToken).toBe('r2')
  })

  it('invalidates the session when the IdP reports the grant is revoked', async () => {
    const store = new SessionStore()
    const id = store.create({ ...base, refreshToken: 'r1', accessExpiresAt: 5_000 }, 0)
    const idn = fakeIdentity(async () => {
      throw Object.assign(new Error('grant revoked'), { error: 'invalid_grant' })
    })
    const svc = new SessionAuthService(store, idn)

    expect(await svc.resolve(id, 6_000)).toBeNull()
    expect(store.get(id, 6_000)).toBeUndefined() // session killed
  })

  it('keeps the session on a transient IdP outage (does NOT log the user out)', async () => {
    const store = new SessionStore()
    const id = store.create({ ...base, refreshToken: 'r1', accessExpiresAt: 5_000 }, 0)
    const idn = fakeIdentity(async () => {
      throw new Error('ECONNREFUSED') // network / IdP down, not a revocation
    })
    const svc = new SessionAuthService(store, idn)

    const s = await svc.resolve(id, 6_000)
    expect(s?.sub).toBe('u1') // served, retried next request
    expect(store.get(id, 6_000)).toBeDefined()
  })

  it('ends an expired session that has no refresh token to renew with', async () => {
    const store = new SessionStore()
    const id = store.create({ ...base, accessExpiresAt: 5_000 }, 0) // expired, no refreshToken
    const idn = fakeIdentity(async () => tokens())
    const svc = new SessionAuthService(store, idn)

    expect(await svc.resolve(id, 6_000)).toBeNull()
    expect(idn.refresh).not.toHaveBeenCalled()
  })

  it('coalesces concurrent expired requests into a single refresh (single-flight)', async () => {
    const store = new SessionStore()
    const id = store.create({ ...base, refreshToken: 'r1', accessExpiresAt: 5_000 }, 0)
    let resolveRefresh!: (t: TokenSet) => void
    const idn = fakeIdentity(() => new Promise<TokenSet>((r) => (resolveRefresh = r)))
    const svc = new SessionAuthService(store, idn)

    const p1 = svc.resolve(id, 6_000)
    const p2 = svc.resolve(id, 6_000)
    resolveRefresh(tokens({ expiresAt: 99_000 }))
    await Promise.all([p1, p2])
    expect(idn.refresh).toHaveBeenCalledTimes(1) // rotating token not burned twice
  })

  it('still enforces the 12h absolute cap even with a fresh access token', async () => {
    const store = new SessionStore()
    const id = store.create({ ...base, refreshToken: 'r1', accessExpiresAt: 5_000 }, 0)
    const idn = fakeIdentity(async () => tokens())
    const svc = new SessionAuthService(store, idn)

    expect(await svc.resolve(id, SESSION_MAX_AGE_MS + 1)).toBeNull()
  })
})
