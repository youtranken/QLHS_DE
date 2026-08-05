import { Injectable } from '@nestjs/common'

const MAX_FAILS = 5
const LOCK_MS = 15 * 60 * 1000
/** A quiet, unlocked counter past this is dead weight — prune it (bound memory). */
const IDLE_TTL_MS = LOCK_MS
/** Hard cap on tracked IPs — a backstop if someone floods us with real IPs. */
const MAX_ENTRIES = 10_000

type Attempt = { fails: number; lockUntil: number; touchedAt: number }

/**
 * Per-IP brute-force lockout for local (break-glass) login. IN-MEMORY: fine for
 * the single-instance on-prem deploy; multi-instance later → move to Redis
 * (tech-debt, not now). The controller checks {@link isLocked} before verifying
 * credentials, records {@link fail} on a bad password, and {@link succeed} to
 * clear the counter on a good one.
 */
@Injectable()
export class LoginThrottle {
  private readonly attempts = new Map<string, Attempt>()

  /** Locked IP → reject WITHOUT touching credentials (no timing/user oracle). */
  isLocked(ip: string, now: number = Date.now()): boolean {
    this.prune(now)
    const a = this.attempts.get(ip)
    return !!a && a.lockUntil > now
  }

  /** Record a failed attempt; returns true if THIS failure tripped the lock. */
  fail(ip: string, now: number = Date.now()): boolean {
    const prev = this.attempts.get(ip)
    // Fresh counter when none exists or a prior lock has since expired.
    const fails = (prev && prev.lockUntil === 0 ? prev.fails : 0) + 1
    if (fails >= MAX_FAILS) {
      this.attempts.set(ip, { fails: 0, lockUntil: now + LOCK_MS, touchedAt: now })
      return true
    }
    this.attempts.set(ip, { fails, lockUntil: 0, touchedAt: now })
    return false
  }

  /** Successful login — drop the counter for this IP. */
  succeed(ip: string): void {
    this.attempts.delete(ip)
  }

  /**
   * Opportunistic cleanup: drop unlocked, long-idle counters; KEEP anything
   * still locked. If still over the hard cap (real-IP flood), shed more unlocked
   * entries until back under.
   */
  private prune(now: number): void {
    for (const [ip, a] of this.attempts) {
      if (a.lockUntil <= now && now - a.touchedAt > IDLE_TTL_MS) {
        this.attempts.delete(ip)
      }
    }
    if (this.attempts.size <= MAX_ENTRIES) return
    for (const [ip, a] of this.attempts) {
      if (this.attempts.size <= MAX_ENTRIES) break
      if (a.lockUntil <= now) this.attempts.delete(ip)
    }
  }
}
