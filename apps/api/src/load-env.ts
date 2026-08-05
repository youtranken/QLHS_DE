import { config } from 'dotenv'

/**
 * Loaded as the very first side-effect import (before AppModule) so every
 * module-level `loadAuthConfig(process.env)` sees the final values.
 *
 * Dev convention: `.env` is the source of truth ("chân lý"). We `override` so a
 * value pinned in the launching shell — e.g. a stale QLHS_LOCAL_ADMIN_PASSWORD
 * left in a long-lived `nest start --watch` process tree — can never shadow the
 * file and keep re-hashing the wrong local-admin secret across hot-reloads.
 *
 * Prod (NODE_ENV=production, Docker) never overrides: Compose `environment:` is
 * authoritative and any `.env` baked into the image must not win over it.
 */
config({ override: process.env.NODE_ENV !== 'production' })
