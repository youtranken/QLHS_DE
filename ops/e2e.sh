#!/usr/bin/env bash
#
# One-shot LOCAL e2e for pre-merge checks. Spins a throwaway Postgres on :5432 with
# the default TEST credentials (qlhs:qlhs / qlhs_app:qlhs_app), migrates it, then runs
# the API integration e2e (vitest, Postgres-backed) and/or the Playwright browser e2e.
#
# Fully isolated from prod: everything is localhost, DEV_AUTH creates the
# applicant/DCC1/2/3 accounts on the fly (NO manual seeding), and nothing touches
# de-qlhs.pmh.com.vn / SSO. The Playwright harness starts its own api (:3100) + web
# (:5273) on isolated ports and resets the throwaway DB between tests.
#
# PREREQUISITE: the local prod-clone stack must be DOWN so :5432 is free and its
# strong password can't shadow the test creds:  docker compose down
#
# Usage:  bash ops/e2e.sh [api|pw|all]      (default: all)
#         bash ops/e2e.sh api               # only the vitest API e2e
#         bash ops/e2e.sh pw                # only Playwright
#
set -euo pipefail

TARGET="${1:-all}"
PG=qlhs-e2e-pg
OWNER_URL="postgresql://qlhs:qlhs@localhost:5432"

cd "$(dirname "$0")/.."

# Guard: the prod-clone Postgres on :5432 uses a STRONG password (prod overlay) and
# would reject the test creds. Refuse to proceed until it's down.
if docker ps --format '{{.Names}}' | grep -q '^qlhs-postgres-1$'; then
  echo "✗ The prod-clone stack is running (qlhs-postgres-1 holds :5432)." >&2
  echo "  Run 'docker compose down' first, then re-run this script." >&2
  exit 1
fi

# 1. Throwaway Postgres (reused if already up).
if ! docker ps --format '{{.Names}}' | grep -q "^${PG}$"; then
  echo "▶ starting ${PG} on :5432 …"
  docker rm -f "$PG" >/dev/null 2>&1 || true
  docker run -d --name "$PG" -p 5432:5432 \
    -e POSTGRES_USER=qlhs -e POSTGRES_PASSWORD=qlhs -e POSTGRES_DB=qlhs \
    postgres:18 >/dev/null
  echo "  waiting for Postgres to accept connections …"
  until docker exec "$PG" pg_isready -U qlhs >/dev/null 2>&1; do sleep 1; done
fi
# The Playwright throwaway DB (the vitest API e2e uses the default `qlhs` DB).
docker exec "$PG" psql -U qlhs -tc "SELECT 1 FROM pg_database WHERE datname='qlhs_e2e'" | grep -q 1 \
  || docker exec "$PG" psql -U qlhs -c 'CREATE DATABASE qlhs_e2e' >/dev/null

# 2. Migrate both DBs as the OWNER (this creates the qlhs_app role + grants + the
#    append-only ticket_event trigger — the app then connects as qlhs_app).
echo "▶ migrating qlhs + qlhs_e2e …"
(
  cd apps/api
  DATABASE_URL="${OWNER_URL}/qlhs?schema=public"     npx prisma migrate deploy
  DATABASE_URL="${OWNER_URL}/qlhs_e2e?schema=public" npx prisma migrate deploy
)

# 3. Run the requested suites.
if [ "$TARGET" = "api" ] || [ "$TARGET" = "all" ]; then
  echo "▶ API integration e2e (vitest, DB-backed) …"
  # Run from the repo root: vitest.config.ts lives here and its include globs are
  # root-relative, so `vitest` must resolve `root` to the repo (running it from
  # apps/api makes `root` default to apps/api → the apps/api/** globs match nothing).
  pnpm exec vitest run apps/api
fi
if [ "$TARGET" = "pw" ] || [ "$TARGET" = "all" ]; then
  echo "▶ building API (Playwright runs apps/api/dist/main.js) …"
  pnpm --filter @qlhs/api build
  echo "▶ Playwright browser e2e (golden journeys) …"
  pnpm --filter @qlhs/web e2e
fi

echo "✔ e2e done. Throwaway DB container '${PG}' left running for the next run."
echo "  Remove it with:  docker rm -f ${PG}"
