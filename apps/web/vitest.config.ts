import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Web component/unit tests (jsdom). Contracts resolve to source like the API
// suite. The API/domain tests live in the root vitest config (node env).
const contractsSrc = fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@qlhs/contracts': contractsSrc } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
  },
})
