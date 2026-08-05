import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

// Tests resolve @qlhs/contracts to SOURCE (fast TDD, no rebuild); production
// builds resolve to dist via the package exports. SWC transform gives NestJS
// decorators their emitted metadata (DI in api e2e). Web jsdom tests: story 1-5.
const contractsSrc = fileURLToPath(
  new URL('./packages/contracts/src/index.ts', import.meta.url),
)

export default defineConfig({
  resolve: {
    alias: { '@qlhs/contracts': contractsSrc },
  },
  test: {
    include: ['packages/**/*.spec.ts', 'apps/api/**/*.spec.ts', 'apps/api/**/*.e2e-spec.ts'],
    environment: 'node',
    // DB e2e files share one Postgres — run files serially to avoid cross-file races.
    fileParallelism: false,
    // Cold Nest+Prisma boot after the (slow) ESM collect can exceed the 10s
    // default; give hooks/tests room.
    hookTimeout: 40000,
    testTimeout: 30000,
    // Tests connect as the restricted app role (append-only enforced). Migrations
    // run separately as the owner.
    env: {
      DATABASE_URL: 'postgresql://qlhs_app:qlhs_app@localhost:5432/qlhs?schema=public',
      // Tests exercise the dev-login path deterministically, regardless of any
      // OIDC vars the app's .env may load into the process.
      DEV_AUTH: '1',
      QLHS_ADMIN_EMAILS: 'admin@test.local',
      // Shared HMAC secret for the PMH ID offboarding webhook e2e.
      PMH_WEBHOOK_SECRET: 'test-webhook-secret',
      // Local (non-SSO) SA bootstrap — exercised by local-admin.e2e.
      QLHS_LOCAL_ADMIN_USERNAME: 'admin.ssa',
      QLHS_LOCAL_ADMIN_PASSWORD: 'Test-Local-SA-1',
      // Pin the test clock to UTC (the prod Docker container's zone) so SLA/date
      // math is deterministic across dev machines, not the runner's local TZ.
      TZ: 'UTC',
      // Silence the notification crons in tests; the outbox e2e drives
      // dispatch()/scan() directly for determinism (Story 5.2).
      QLHS_DISABLE_CRON: '1',
      // Off by default so a burst of supertest calls from one loopback IP can't
      // trip the rate limiter mid-suite; auth-throttle.e2e turns it back on.
      QLHS_DISABLE_THROTTLE: '1',
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
})
