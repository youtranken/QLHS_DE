import { Injectable } from '@nestjs/common'
import { SessionStore, type Session } from './session.store'
import type { TokenSet } from '../../domain/auth/identity.port'

/** Just the refresh capability of the identity provider — all resolve() needs. */
export interface RefreshableIdentity {
  refresh(refreshToken: string): Promise<TokenSet>
}

// OAuth errors that mean THIS USER's grant is dead (logged out / disabled at PMH
// ID, refresh token revoked or rotated away) → kill the session. Deliberately
// excludes invalid_client/unauthorized_client: those are APP-level (client secret
// rotated/blipped) and would mass-logout every SSO user at once — treat as a
// transient outage instead. Anything else (network, discovery, 5xx) is transient too.
const REVOCATION_CODES = ['invalid_grant', 'invalid_token']

/**
 * Turns the access-token lifetime into the effective revocation window without
 * depending on back-channel logout. AuthGuard calls resolve() every request: a
 * live token serves cached claims; an expired one is silently refreshed via the
 * stored refresh_token. A revoked grant ends the session (→ 401 → re-login); a
 * transient outage keeps it so an IdP blip isn't a mass logout. Roles are still
 * re-read from the DB in AuthGuard — this layer only governs session liveness.
 */
@Injectable()
export class SessionAuthService {
  private readonly inflight = new Map<string, Promise<Session | null>>()

  constructor(
    private readonly sessions: SessionStore,
    private readonly identity: RefreshableIdentity,
  ) {}

  async resolve(sid: string | undefined, now: number = Date.now()): Promise<Session | null> {
    const session = this.sessions.get(sid, now)
    if (!session || sid === undefined) return null
    // Local break-glass SA (and dev) sessions carry no OIDC token — their
    // liveness is bounded solely by the 12h absolute cap in SessionStore.
    if (session.accessExpiresAt === undefined) return session
    if (session.accessExpiresAt > now) return session
    return this.refreshExpired(sid, session, now)
  }

  /** Coalesce concurrent expired requests so a rotating refresh token is spent once. */
  private refreshExpired(sid: string, session: Session, now: number): Promise<Session | null> {
    const existing = this.inflight.get(sid)
    if (existing) return existing
    const p = this.doRefresh(sid, session, now).finally(() => this.inflight.delete(sid))
    this.inflight.set(sid, p)
    return p
  }

  private async doRefresh(sid: string, session: Session, now: number): Promise<Session | null> {
    if (!session.refreshToken) {
      this.sessions.delete(sid) // expired with nothing to renew ⇒ session ended
      return null
    }
    try {
      const next = await this.identity.refresh(session.refreshToken)
      return (
        this.sessions.updateTokens(
          sid,
          { accessExpiresAt: next.expiresAt, refreshToken: next.refreshToken },
          now,
        ) ?? null
      )
    } catch (err) {
      if (isRevocation(err)) {
        this.sessions.delete(sid)
        return null
      }
      return session // transient outage: serve stale claims, retry next request
    }
  }
}

function isRevocation(err: unknown): boolean {
  const code = (err as { error?: unknown })?.error
  if (typeof code === 'string' && REVOCATION_CODES.includes(code)) return true
  const msg = err instanceof Error ? err.message.toLowerCase() : ''
  return REVOCATION_CODES.some((c) => msg.includes(c))
}
