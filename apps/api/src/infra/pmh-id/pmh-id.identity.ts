import { Injectable } from '@nestjs/common'
import * as oidc from 'openid-client'
import * as jose from 'jose'
import { loadAuthConfig, type OidcConfig } from '../../config/auth.config'
import type { AuthenticatedUser, TokenSet } from '../../domain/auth/identity.port'

const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout'

/**
 * PMH ID OIDC confidential client (BFF, AD-8). Authorization Code + PKCE; the
 * refresh token + client_secret stay here (never sent to the SPA). Discovery is
 * lazy + cached.
 */
@Injectable()
export class PmhIdIdentity {
  private readonly cfg = loadAuthConfig(process.env)
  private discovered?: ReturnType<typeof oidc.discovery>

  private oidcCfg(): OidcConfig {
    if (!this.cfg.oidc) throw new Error('OIDC not configured (OIDC_ISSUER missing)')
    return this.cfg.oidc
  }

  private config(): ReturnType<typeof oidc.discovery> {
    if (!this.discovered) {
      const o = this.oidcCfg()
      // PMH ID (panva oidc-provider) uses client_secret_basic; openid-client v6
      // otherwise defaults to client_secret_post → invalid_client.
      this.discovered = oidc.discovery(
        new URL(o.issuer),
        o.clientId,
        o.clientSecret,
        oidc.ClientSecretBasic(o.clientSecret),
      )
    }
    return this.discovered
  }

  async authorizationUrl(opts?: { loginHint?: string }): Promise<{
    url: string
    state: string
    nonce: string
    verifier: string
  }> {
    const config = await this.config()
    const verifier = oidc.randomPKCECodeVerifier()
    const challenge = await oidc.calculatePKCECodeChallenge(verifier)
    const state = oidc.randomState()
    const nonce = oidc.randomNonce()
    const loginHint = sanitizeLoginHint(opts?.loginHint)
    const url = oidc.buildAuthorizationUrl(config, {
      // PMH ID supports only openid + offline_access; user claims (email,
      // groups, employee_code, full_name) come back by default. offline_access
      // is required to receive a refresh token.
      redirect_uri: this.oidcCfg().redirectUri,
      scope: 'openid offline_access',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      // Pre-fill the IdP login form with the email the user already typed.
      ...(loginHint ? { login_hint: loginHint } : {}),
    })
    return { url: url.href, state, nonce, verifier }
  }

  async exchange(
    callbackUrl: URL,
    verifier: string,
    state: string,
    nonce: string,
  ): Promise<{ user: AuthenticatedUser; tokens: TokenSet }> {
    const config = await this.config()
    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: verifier,
      expectedState: state,
      expectedNonce: nonce,
    })
    const claims = tokens.claims()
    const sub = claims?.sub
    if (typeof sub !== 'string') throw new Error('id_token missing sub')
    return {
      user: {
        sub,
        groups: extractGroups(claims?.['groups']),
        // PMH ID delivers the full name as `full_name`; `name` is a fallback. Use
        // `||` (not `??`) so an EMPTY `full_name` still falls back to `name`.
        displayName: asString(claims?.['full_name']) || asString(claims?.['name']) || undefined,
        email: asString(claims?.['email']),
      },
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + expiresInSeconds(tokens.expires_in) * 1000,
        idToken: tokens.id_token,
      },
    }
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const config = await this.config()
    const tokens = await oidc.refreshTokenGrant(config, refreshToken)
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + expiresInSeconds(tokens.expires_in) * 1000,
      idToken: tokens.id_token,
    }
  }

  private jwks?: ReturnType<typeof jose.createRemoteJWKSet>

  private remoteJwks(): ReturnType<typeof jose.createRemoteJWKSet> {
    if (!this.jwks) {
      this.jwks = jose.createRemoteJWKSet(new URL(`${this.oidcCfg().issuer}/jwks`))
    }
    return this.jwks
  }

  /**
   * Verify an OIDC back-channel logout_token (signature via JWKS + iss/aud),
   * confirm it carries the backchannel-logout event and NO nonce, return `sub`.
   */
  async verifyLogoutToken(token: string): Promise<string> {
    const o = this.oidcCfg()
    const { payload } = await jose.jwtVerify(token, this.remoteJwks(), {
      issuer: o.issuer,
      audience: o.clientId,
    })
    const events = payload['events'] as Record<string, unknown> | undefined
    if (!events?.[BACKCHANNEL_LOGOUT_EVENT] || 'nonce' in payload) {
      throw new Error('not a valid logout_token')
    }
    if (typeof payload.sub !== 'string') throw new Error('logout_token missing sub')
    return payload.sub
  }
}

/**
 * Only forward `login_hint` when it's a plausible email + length-capped — the
 * value comes straight from a query param (untrusted). A bad hint is dropped,
 * not rejected: login still proceeds, just without pre-fill.
 */
export function sanitizeLoginHint(raw?: string): string | undefined {
  const v = raw?.trim()
  if (!v || v.length > 200) return undefined
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined
}

function extractGroups(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((g): g is string => typeof g === 'string') : []
}
function asString(raw: unknown): string | undefined {
  return typeof raw === 'string' ? raw : undefined
}
function expiresInSeconds(raw: unknown): number {
  return typeof raw === 'number' ? raw : 300
}
