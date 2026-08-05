import type { NestExpressApplication } from '@nestjs/platform-express'
import helmet from 'helmet'

/**
 * 1.2 — the edge hardening that must be on every deployed response. Kept in one
 * named function so `main.ts` and the security e2e apply the SAME thing, and so
 * removing it is a one-line, reviewable change rather than a scattered edit.
 */
export function applyHardening(app: NestExpressApplication): void {
  // Behind the on-prem nginx: trust exactly one hop so `req.ip` is the real
  // client the login limiter keys on. More hops let a client spoof
  // X-Forwarded-For; fewer collapse every user into one shared IP.
  app.set('trust proxy', 1)
  // The API only ever returns JSON and redirects, so helmet's defaults (HSTS,
  // nosniff, no framing, hidden X-Powered-By, a locked-down CSP) cost nothing —
  // the SPA is served separately by nginx.
  app.use(helmet())
}
