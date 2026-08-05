/**
 * Integration boundary for PMH ID (AD-1/AD-12). The domain knows only this
 * port; all OIDC/openid-client/jose machinery lives in infra/pmh-id. Types only
 * — no framework/IO imports here.
 */
export interface AuthenticatedUser {
  /** PMH ID `sub` — THE identity used for every user FK (AD-7). Never email. */
  sub: string
  groups: string[]
  displayName?: string
  email?: string
}

export interface TokenSet {
  accessToken: string
  /** Kept server-side only (BFF) — never sent to the SPA. */
  refreshToken?: string
  /** Absolute expiry, epoch milliseconds. */
  expiresAt: number
  idToken?: string
}

export interface IdentityPort {
  /** Build the OIDC Authorization Code (PKCE) redirect URL. */
  authorizationUrl(input: { state: string; nonce: string; codeChallenge: string }): string
  exchangeCode(input: {
    code: string
    codeVerifier: string
    expectedNonce: string
  }): Promise<{ user: AuthenticatedUser; tokens: TokenSet }>
  refresh(refreshToken: string): Promise<TokenSet>
  /** Offline JWT verification (JWKS, assert iss/aud). No network per request. */
  verifyAccess(accessToken: string): Promise<AuthenticatedUser>
}
