import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common'
import { timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'

/** Length-checked constant-time compare so the token can't be recovered byte-by-byte
 *  from response timing (timingSafeEqual itself throws on unequal lengths). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/**
 * Guards `/metrics` with an optional static bearer token (`QLHS_METRICS_TOKEN`).
 * On-prem the endpoint usually sits behind an nginx allow-list, so in dev / a
 * trusted network the scrape is open when no token is configured. Set the env
 * var to require `Authorization: Bearer <token>` — a cheap gate for the case
 * where the scraper is off-box. In production we fail closed instead: an unset
 * token means the endpoint stays shut, never silently world-readable.
 */
@Injectable()
export class MetricsGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    // trim() so a blank/whitespace value counts as "not configured".
    const expected = process.env.QLHS_METRICS_TOKEN?.trim()
    if (!expected) {
      // Fail closed in production: no token → deny rather than expose metrics
      // (backlog counts, ticket volumes) unauthenticated. Dev stays open.
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException({ code: 'Unauthenticated', message: 'metrics token' })
      }
      return true
    }
    const req = ctx.switchToHttp().getRequest<Request>()
    const header = req.headers.authorization ?? ''
    const presented = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!safeEqual(presented, expected)) {
      throw new UnauthorizedException({ code: 'Unauthenticated', message: 'metrics token' })
    }
    return true
  }
}
