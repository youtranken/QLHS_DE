/**
 * Environment config, validated at boot (fail-fast). No hardcoded secrets —
 * everything is read from process.env / .env (see .env.example). Pure function
 * so it is unit-testable without booting Nest or touching a real environment.
 */
export interface Env {
  PORT: number
  DATABASE_URL: string
}

export function loadEnv(src: NodeJS.ProcessEnv): Env {
  const DATABASE_URL = src.DATABASE_URL
  if (!DATABASE_URL || DATABASE_URL.trim() === '') {
    throw new Error('Missing required env: DATABASE_URL')
  }

  const rawPort = src.PORT ?? '3000'
  const PORT = Number(rawPort)
  if (!Number.isInteger(PORT) || PORT <= 0 || PORT > 65535) {
    throw new Error(`Invalid env PORT: ${rawPort}`)
  }

  return { PORT, DATABASE_URL }
}
