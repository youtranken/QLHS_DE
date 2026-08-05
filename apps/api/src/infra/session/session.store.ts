import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Role } from '@qlhs/contracts'

/**
 * Server-side BFF session (AD-8). Tokens never leave the API — the SPA only
 * holds an opaque httpOnly cookie carrying the session id. In-memory is fine for
 * a single on-prem instance (~300 users, low concurrency).
 *
 * The IdP owns token/refresh lifetime; this store adds an absolute cap so a
 * local cookie can't outlive it forever (covers local-SA sessions too, which
 * have no IdP behind them). Roles are re-read from the DB per request in the
 * AuthGuard — never trusted from here — so grants/revocations apply live.
 */
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000

export interface Session {
  sub: string
  groups: string[]
  roles: Role[]
  activeRole: Role | null
  displayName?: string
  email?: string
  refreshToken?: string
  accessExpiresAt?: number
  createdAt: number
}

@Injectable()
export class SessionStore {
  private readonly sessions = new Map<string, Session>()

  create(session: Omit<Session, 'createdAt'>, now: number = Date.now()): string {
    const id = randomUUID()
    this.sessions.set(id, { ...session, createdAt: now })
    return id
  }

  get(id: string | undefined, now: number = Date.now()): Session | undefined {
    if (!id) return undefined
    const session = this.sessions.get(id)
    if (!session) return undefined
    if (now - session.createdAt > SESSION_MAX_AGE_MS) {
      this.sessions.delete(id)
      return undefined
    }
    return session
  }

  delete(id: string | undefined): void {
    if (id) this.sessions.delete(id)
  }

  /** Persist rotated OIDC tokens after a silent refresh; null if the session
   * vanished mid-flight (e.g. a back-channel logout raced the refresh). */
  updateTokens(
    id: string,
    patch: { accessExpiresAt: number; refreshToken?: string },
    now: number = Date.now(),
  ): Session | undefined {
    const session = this.get(id, now)
    if (!session) return undefined
    session.accessExpiresAt = patch.accessExpiresAt
    if (patch.refreshToken !== undefined) session.refreshToken = patch.refreshToken
    return session
  }

  setActiveRole(id: string, role: Role): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.activeRole = role
    return true
  }

  /** Kill every session for a user (OIDC back-channel logout). */
  deleteBySub(sub: string): number {
    let killed = 0
    for (const [id, session] of this.sessions) {
      if (session.sub === sub) {
        this.sessions.delete(id)
        killed++
      }
    }
    return killed
  }
}
