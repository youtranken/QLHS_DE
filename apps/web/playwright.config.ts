import { defineConfig, devices } from '@playwright/test'

// 3.1 — browser e2e for the golden journeys. Runs on isolated ports over plain
// HTTP against a throwaway database (qlhs_e2e), so it never touches dev data or
// collides with the on-prem :5173 HTTPS server / docker stack.
const API = process.env.E2E_API_URL ?? 'http://localhost:3100'
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:5273'
const APP_DB =
  process.env.E2E_APP_DB_URL ?? 'postgresql://qlhs_app:qlhs_app@localhost:5432/qlhs_e2e?schema=public'

export default defineConfig({
  testDir: './e2e',
  // One worker + serial: every test shares the one throwaway DB and resets it.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 40_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: { baseURL: WEB, trace: 'retain-on-failure', ignoreHTTPSErrors: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node apps/api/dist/main.js',
      cwd: '../..',
      url: `${API}/health`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: APP_DB,
        DEV_AUTH: '1',
        QLHS_DISABLE_CRON: '1',
        QLHS_DISABLE_THROTTLE: '1',
        PORT: '3100',
      },
    },
    {
      command: 'pnpm --filter @qlhs/web dev',
      cwd: '../..',
      url: WEB,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: { E2E: '1', VITE_PORT: '5273', VITE_API_TARGET: API },
    },
  ],
})
