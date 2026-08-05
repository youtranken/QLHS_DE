#!/usr/bin/env bash
# Dev mode: only the infra containers. API + Web run on the HOST via pnpm for
# hot-reload, with apps/api/.env as the single source of truth.
#
# NEVER run this alongside `ops/deploy.sh`: two apis writing one DB + docker web
# owning :5173 is exactly what makes "wrong password" / "stale UI" happen.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ Stopping any full-stack api/web (avoid the two-stacks-at-once trap)…"
docker compose stop api web pg-backup 2>/dev/null || true

# mailpit is a `dev`-profile service (kept out of prod). `--profile dev` starts it
# alongside postgres; prod's `up -d` has no such profile so it never runs there.
echo "▸ Starting infra only (postgres + mailpit)…"
docker compose --profile dev up -d postgres mailpit

cat <<'EOF'
✓ Infra up. Now run the app on the host (two terminals):
    pnpm --filter @qlhs/api start:dev      # API  → :3000
    pnpm --filter @qlhs/web dev            # Web  → https://qlhs.pmh.com.vn:5173

First time / after a schema change, migrate the dev DB:
    pnpm --filter @qlhs/api prisma:migrate:dev
EOF
