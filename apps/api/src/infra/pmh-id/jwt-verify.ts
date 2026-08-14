import { jwtVerify, createLocalJWKSet, type JSONWebKeySet, type JWTPayload } from 'jose'
import type { AuthenticatedUser } from '../../domain/auth/identity.port'

export interface VerifyConfig {
  jwks: JSONWebKeySet
  issuer: string
  audience: string
}

/**
 * Offline JWT verification (AD-8): verify the RS256 signature against a cached
 * JWKS (key chosen by `kid`) and REQUIRE matching `iss` + `aud`. The aud check
 * is the confused-deputy guard in a multi-client SSO. No network per request.
 */
export async function verifyAccessToken(
  token: string,
  cfg: VerifyConfig,
): Promise<AuthenticatedUser> {
  const jwkSet = createLocalJWKSet(cfg.jwks)
  const { payload } = await jwtVerify(token, jwkSet, {
    issuer: cfg.issuer,
    audience: cfg.audience,
    algorithms: ['RS256'],
  })
  return claimsToUser(payload)
}

export function claimsToUser(payload: JWTPayload): AuthenticatedUser {
  const sub = payload.sub
  if (!sub) throw new Error('JWT missing required claim: sub')
  const groups = Array.isArray(payload['groups'])
    ? (payload['groups'] as unknown[]).filter((g): g is string => typeof g === 'string')
    : []
  // PMH ID carries the person's full name under `full_name`; the standard OIDC
  // `name` claim is a fallback (kept for other IdPs / tokens). Without this the
  // display name is empty and the UI falls back to the email local-part. Prefer
  // `full_name` only when it is a NON-EMPTY string, else fall through to `name`.
  const fullName = payload['full_name']
  const name = typeof fullName === 'string' && fullName.trim() !== '' ? fullName : payload['name']
  const email = payload['email']
  return {
    sub,
    groups,
    displayName: typeof name === 'string' && name.trim() !== '' ? name : undefined,
    email: typeof email === 'string' ? email : undefined,
  }
}
