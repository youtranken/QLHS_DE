import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Serve HTTPS with the real *.pmh.com.vn cert when present (needed so the OIDC
// redirect lands on https://qlhs.pmh.com.vn:5173). Falls back to http if the
// cert folder is absent (CI / other machines).
// E2E (3.1) runs on isolated ports over plain HTTP against a throwaway DB, so it
// never collides with the on-prem :5173 HTTPS dev server or the docker stack.
const isE2E = process.env.E2E === '1'
const port = Number(process.env.VITE_PORT ?? 5173)
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:3000'

const certDir = fileURLToPath(new URL('../../pmh.com.vn/', import.meta.url))
const https =
  !isE2E && existsSync(`${certDir}fullchain.pem`)
    ? {
        cert: readFileSync(`${certDir}fullchain.pem`),
        key: readFileSync(`${certDir}private.key`),
      }
    : undefined

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port,
    ...(https ? { https } : {}),
    proxy: {
      // Strip /api so dev matches prod nginx; the API has no global prefix.
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
