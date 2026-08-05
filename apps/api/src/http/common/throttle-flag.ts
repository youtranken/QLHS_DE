/**
 * The test-only throttle kill-switch. `QLHS_DISABLE_THROTTLE=1` turns off both the
 * global ThrottlerModule and the per-IP login lockout so a burst of supertest
 * calls from one loopback IP can't make suites flaky (the limiter has its own
 * dedicated e2e).
 *
 * HARD-GATED off in production: even if the flag leaks into a prod env (it lives
 * in dev muscle memory — vitest/playwright configs set it), the switch is inert,
 * so break-glass local-admin login always keeps its brute-force lockout. Mirrors
 * how DEV_AUTH / cookieSecure force their safe value when NODE_ENV=production.
 * Read live (per request) so both call sites agree without wiring config.
 */
export function throttleDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.QLHS_DISABLE_THROTTLE === '1' && env.NODE_ENV !== 'production'
}
