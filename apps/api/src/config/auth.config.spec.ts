import { describe, it, expect } from 'vitest'
import { loadAuthConfig } from './auth.config'

const OIDC = {
  OIDC_ISSUER: 'https://sso.pmh.example',
  OIDC_CLIENT_ID: 'qlhs-web',
  OIDC_CLIENT_SECRET: 's3cret',
  OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
}

describe('loadAuthConfig', () => {
  it('enables devAuth when OIDC is absent and not production', () => {
    const cfg = loadAuthConfig({ NODE_ENV: 'development' })
    expect(cfg.oidc).toBeNull()
    expect(cfg.devAuth).toBe(true)
  })

  it('parses OIDC when all four vars are present', () => {
    const cfg = loadAuthConfig({ ...OIDC, NODE_ENV: 'production', QLHS_ALLOWED_GROUPS: 'qlhs-users' })
    expect(cfg.oidc).toEqual({
      issuer: OIDC.OIDC_ISSUER,
      clientId: OIDC.OIDC_CLIENT_ID,
      clientSecret: OIDC.OIDC_CLIENT_SECRET,
      redirectUri: OIDC.OIDC_REDIRECT_URI,
    })
    expect(cfg.cookieSecure).toBe(true)
  })

  it('disables devAuth in production when OIDC is absent (fail closed)', () => {
    const cfg = loadAuthConfig({ NODE_ENV: 'production' })
    expect(cfg.devAuth).toBe(false)
  })

  it('honours an explicit DEV_AUTH=1 override outside production', () => {
    const cfg = loadAuthConfig({ ...OIDC, NODE_ENV: 'development', DEV_AUTH: '1' })
    expect(cfg.devAuth).toBe(true)
  })

  it('NEVER enables devAuth in production, even with DEV_AUTH=1 (fail closed)', () => {
    // A stray DEV_AUTH=1 in a prod env must not re-open the dev-login auth bypass.
    const cfg = loadAuthConfig({
      ...OIDC,
      NODE_ENV: 'production',
      DEV_AUTH: '1',
      QLHS_ALLOWED_GROUPS: 'qlhs-users',
    })
    expect(cfg.devAuth).toBe(false)
  })

  it('refuses to boot in production when SSO is on but the group gate is wide open (fail closed)', () => {
    // An empty allow-list silently admits anyone who completes the OIDC round-trip.
    // In prod that single-point-of-failure must be an explicit, loud choice.
    expect(() => loadAuthConfig({ ...OIDC, NODE_ENV: 'production' })).toThrow(/QLHS_ALLOWED_GROUPS/)
  })

  it('allows an explicit opt-out of the group gate in production', () => {
    const cfg = loadAuthConfig({
      ...OIDC,
      NODE_ENV: 'production',
      QLHS_ALLOW_ALL_GROUPS: '1',
    })
    expect(cfg.allowedGroups).toEqual([])
  })

  it('does not require the group gate outside production, or when SSO is absent', () => {
    expect(() => loadAuthConfig({ ...OIDC, NODE_ENV: 'development' })).not.toThrow()
    expect(() => loadAuthConfig({ NODE_ENV: 'production' })).not.toThrow()
  })

  it('parses the local SA username + password', () => {
    const cfg = loadAuthConfig({
      QLHS_LOCAL_ADMIN_USERNAME: 'admin.ssa',
      QLHS_LOCAL_ADMIN_PASSWORD: 'secret',
    })
    expect(cfg.localAdmin).toEqual({ username: 'admin.ssa', password: 'secret' })
  })

  it('accepts the legacy EMAIL var, stripping the @domain to a username', () => {
    const cfg = loadAuthConfig({
      QLHS_LOCAL_ADMIN_EMAIL: 'admin.ssa@local.com',
      QLHS_LOCAL_ADMIN_PASSWORD: 'secret',
    })
    expect(cfg.localAdmin).toEqual({ username: 'admin.ssa', password: 'secret' })
  })

  it('has no local SA when either half is missing', () => {
    expect(loadAuthConfig({ QLHS_LOCAL_ADMIN_USERNAME: 'admin.ssa' }).localAdmin).toBeNull()
    expect(loadAuthConfig({ QLHS_LOCAL_ADMIN_PASSWORD: 'x' }).localAdmin).toBeNull()
  })
})
