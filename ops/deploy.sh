#!/usr/bin/env bash
# Prod-like / on-prem deploy: rebuild images from current source, then bring the
# full stack up. Migrations run automatically inside the api entrypoint, and web
# waits for api to be *healthy* — so one command gives a consistent stack.
#
# Immutable-image rule: FE/BE source changes are only picked up by `build`. If
# you edited code and skip the build, :5173 keeps serving the previous bundle.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ Building images from current source…"
docker compose build

echo "▸ Starting the full stack (api runs prisma migrate deploy on boot)…"
docker compose up -d

echo "▸ Waiting for api to report healthy…"
until [ "$(docker compose ps api --format '{{.Health}}')" = "healthy" ]; do
  sleep 2
done

docker compose ps
echo "✓ Deployed. Web (HTTPS): https://qlhs.pmh.com.vn:5173 · on-prem HTTP: :18080"
