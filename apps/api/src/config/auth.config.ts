/**
 * Auth configuration. OIDC is optional at boot: when the PMH ID client is not
 * yet provisioned (the story 1.2 external precondition), the app falls back to
 * dev-login for local/testing. Pure + unit-testable.
 */
export interface OidcConfig {
  issuer: string
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface AuthConfig {
  oidc: OidcConfig | null
  /** When true, /auth/dev-login can mint sessions without the real IdP. */
  devAuth: boolean
  cookieName: string
  cookieSecure: boolean
  /** Where the SPA lives — post-login/logout redirect target. */
  webOrigin: string
  postLogoutRedirectUri: string
  /** Emails auto-granted the local Admin (SA) role on login (bootstrap). */
  adminEmails: string[]
  /** The break-glass local (non-SSO) SA, seeded on boot. Keyed by a USERNAME
   *  (e.g. "admin.ssa"), never an email. Null when not configured. */
  localAdmin: { username: string; password: string } | null
  /**
   * PMH ID groups allowed into QLHS. EMPTY = gate OFF (fail-open): rely on PMH
   * ID's own per-client grant. Non-empty = only these groups may complete SSO
   * login, so someone who knows the URL but lacks the group can't get in.
   */
  allowedGroups: string[]
  /** HMAC secret for the PMH ID offboarding webhook. Null = webhook disabled
   *  (every delivery is rejected fail-closed). */
  webhookSecret: string | null
}

export function loadAuthConfig(src: NodeJS.ProcessEnv): AuthConfig {
  const issuer = src.OIDC_ISSUER
  const clientId = src.OIDC_CLIENT_ID
  const clientSecret = src.OIDC_CLIENT_SECRET
  const redirectUri = src.OIDC_REDIRECT_URI
  const oidc: OidcConfig | null =
    issuer && clientId && clientSecret && redirectUri
      ? { issuer, clientId, clientSecret, redirectUri }
      : null

  const isProd = src.NODE_ENV === 'production'
  // Fail closed: dev-login (an unauthenticated session minter) is NEVER available
  // in production, even if a stray DEV_AUTH=1 leaks into the prod env.
  const devAuth = !isProd && (src.DEV_AUTH === '1' || !oidc)
  const webOrigin = src.WEB_ORIGIN ?? 'http://localhost:5173'

  const allowedGroups = (src.QLHS_ALLOWED_GROUPS ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)

  // Fail closed: with SSO live in production, an empty allow-list admits anyone
  // who completes the OIDC round-trip (the gate is a no-op). Refuse to boot so
  // the insecure posture is an explicit choice (QLHS_ALLOW_ALL_GROUPS=1), never
  // a forgotten env var.
  if (isProd && oidc && allowedGroups.length === 0 && src.QLHS_ALLOW_ALL_GROUPS !== '1') {
    throw new Error(
      'QLHS_ALLOWED_GROUPS is empty in production: the SSO group gate would admit ' +
        'every authenticated PMH ID user. Set QLHS_ALLOWED_GROUPS=grp1,grp2, or ' +
        'QLHS_ALLOW_ALL_GROUPS=1 to intentionally rely on PMH ID’s per-client grant alone.',
    )
  }

  // Break-glass SA username (e.g. 'admin.ssa', matching QLTS). Accepts the legacy
  // QLHS_LOCAL_ADMIN_EMAIL for back-compat, stripping any @domain to a username.
  const laUser =
    src.QLHS_LOCAL_ADMIN_USERNAME?.trim() || src.QLHS_LOCAL_ADMIN_EMAIL?.trim().split('@')[0]
  const laPassword = src.QLHS_LOCAL_ADMIN_PASSWORD
  const localAdmin = laUser && laPassword ? { username: laUser, password: laPassword } : null

  return {
    oidc,
    devAuth,
    cookieName: 'qlhs_sid',
    cookieSecure: isProd,
    webOrigin,
    postLogoutRedirectUri: src.OIDC_POST_LOGOUT_REDIRECT_URI ?? `${webOrigin}/`,
    adminEmails: (src.QLHS_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    localAdmin,
    allowedGroups,
    webhookSecret: src.PMH_WEBHOOK_SECRET?.trim() || null,
  }
}
