#!/bin/sh
# On-prem start: apply pending migrations BEFORE the app opens, so a fresh or
# upgraded DB is never queried against an old schema. `migrate deploy` is
# idempotent + takes a Postgres advisory lock, so parallel replicas are safe.
#
# Migrations run as the MIGRATION role (MIGRATE_DATABASE_URL, a superuser): the
# first migration CREATE ROLEs the restricted app login and, on PG15+, only a
# privileged role may CREATE in schema public. The app itself then runs as the
# restricted role (DATABASE_URL) — append-only on ticket_event is enforced by a
# trigger for every non-superuser, so the app can never mutate the audit (AD-4).
set -e

RUNTIME_URL="$DATABASE_URL"
export DATABASE_URL="${MIGRATE_DATABASE_URL:-$DATABASE_URL}"

echo "[entrypoint] prisma migrate deploy (migration role)…"
if [ -x ./node_modules/.bin/prisma ]; then
  PRISMA="./node_modules/.bin/prisma"
else
  PRISMA="node ./node_modules/prisma/build/index.js"
fi
$PRISMA migrate deploy

# Đặt mật khẩu MẠNH cho role app (qlhs_app) từ env — CHỈ khi có QLHS_APP_PASSWORD (prod).
# Migration tạo role với mật khẩu placeholder 'qlhs_app'; prod ép mật khẩu thật, KHÔNG
# hardcode. Chạy lúc DATABASE_URL vẫn = superuser (MIGRATE_DATABASE_URL). Idempotent.
# QLHS_APP_PASSWORD chỉ dùng [A-Za-z0-9] (sinh hex) nên an toàn trong chuỗi SQL.
# Dev không set QLHS_APP_PASSWORD → bỏ qua, giữ nguyên qlhs_app/qlhs_app.
if [ -n "${QLHS_APP_PASSWORD:-}" ]; then
  echo "[entrypoint] đặt mật khẩu mạnh cho role qlhs_app từ env…"
  printf "ALTER ROLE qlhs_app WITH PASSWORD '%s';" "$QLHS_APP_PASSWORD" \
    | $PRISMA db execute --stdin --url "$DATABASE_URL"
fi

export DATABASE_URL="$RUNTIME_URL"
echo "[entrypoint] migrations applied — starting API (runtime role)"
exec node dist/main.js
