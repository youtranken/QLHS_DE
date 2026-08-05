#!/usr/bin/env bash
# 1.5 — operational RESTORE: bring the live QLHS database back from a backup
# artefact produced by backup.sh (qlhs-<ts>.dump + globals-<ts>.sql).
#
# DESTRUCTIVE: drops and recreates the target database ($PGDATABASE, default
# `qlhs`), then loads the dump. Refuses to run unless CONFIRM=RESTORE is set, so
# it can never fire by accident. To only *verify* a backup without touching the
# live DB, use test-restore.sh (restores into a throwaway DB) instead.
#
#   Host:       PGHOST=localhost PGPORT=5432 CONFIRM=RESTORE \
#                 ./ops/backup/restore.sh data-backups/qlhs-YYYYMMDD-HHMMSS.dump
#   Container:  docker compose run --rm -e CONFIRM=RESTORE pg-backup \
#                 bash /ops/restore.sh /backups/qlhs-YYYYMMDD-HHMMSS.dump
#   Bare cluster (also rebuild the qlhs/qlhs_app roles from the sibling globals):
#               RELOAD_GLOBALS=1 CONFIRM=RESTORE \
#                 ./ops/backup/restore.sh data-backups/qlhs-YYYYMMDD-HHMMSS.dump
set -euo pipefail

DUMP="${1:?usage: restore.sh <path-to-qlhs-*.dump>}"
[ -f "$DUMP" ] || { echo "dump not found: $DUMP" >&2; exit 1; }

export PGHOST="${PGHOST:-postgres}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-qlhs}"
# Same rule as backup.sh — the DB password comes from env/secret, no weak default.
export PGPASSWORD="${PGPASSWORD:?PGPASSWORD required — pass it via env/secret, no default}"
TARGET_DB="${PGDATABASE:-qlhs}"

# Destructive overwrite of the live DB — refuse unless explicitly confirmed.
if [ "${CONFIRM:-}" != "RESTORE" ]; then
  echo "REFUSING: this DROPs and recreates database '$TARGET_DB' on $PGHOST:$PGPORT." >&2
  echo "Re-run with CONFIRM=RESTORE to proceed." >&2
  exit 2
fi

log() { echo "[pg-restore $(date -Is)] $*"; }

# Optional: rebuild cluster roles (qlhs / qlhs_app + passwords) on a BLANK
# cluster. On an existing cluster this reports "role already exists" — expected,
# so it is opt-in and its errors are non-fatal. globals file is the sibling of
# the dump: qlhs-<ts>.dump ↔ globals-<ts>.sql.
if [ "${RELOAD_GLOBALS:-0}" = "1" ]; then
  ts="$(basename "$DUMP" .dump)"; ts="${ts#qlhs-}"
  GLOBALS="${GLOBALS:-$(dirname "$DUMP")/globals-$ts.sql}"
  [ -f "$GLOBALS" ] || { echo "globals file not found: $GLOBALS" >&2; exit 1; }
  log "reloading cluster roles ← $(basename "$GLOBALS") (errors for existing roles are expected)"
  psql --dbname=postgres -f "$GLOBALS" || log "globals reload had warnings (existing roles?) — continuing"
fi

# Drop + recreate from the maintenance DB (can't drop the DB you're connected to);
# terminate any live sessions first, or DROP DATABASE blocks.
log "dropping + recreating database '$TARGET_DB'"
psql --dbname=postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "$TARGET_DB";
CREATE DATABASE "$TARGET_DB" OWNER "$PGUSER";
SQL

# --no-owner: reassign objects to the connecting user; the schema's GRANTs still
# target qlhs_app, which must exist (present cluster-wide, or reloaded above).
log "restoring $(basename "$DUMP") → $TARGET_DB"
pg_restore --no-owner --exit-on-error --dbname="$TARGET_DB" "$DUMP"

log "verifying core tables"
for tbl in ticket ticket_event sla_config user_role; do
  n="$(psql -tA -d "$TARGET_DB" -c "SELECT count(*) FROM \"$tbl\";" 2>/dev/null || echo '?')"
  log "  $tbl: $n rows"
done
log "RESTORE OK → $TARGET_DB"
