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

# A *.enc artefact was encrypted by backup.sh — decrypt on the fly with the same
# BACKUP_PASSPHRASE. Plain artefacts pass straight through.
is_enc() { case "$1" in *.enc) return 0 ;; *) return 1 ;; esac; }
decrypt_from() { openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$1"; }

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
  base="$(basename "$DUMP")"; base="${base%.enc}"; ts="${base#qlhs-}"; ts="${ts%.dump}"
  gl_ext=""; is_enc "$DUMP" && gl_ext=".enc"
  GLOBALS="${GLOBALS:-$(dirname "$DUMP")/globals-$ts.sql$gl_ext}"
  [ -f "$GLOBALS" ] || { echo "globals file not found: $GLOBALS" >&2; exit 1; }
  log "reloading cluster roles ← $(basename "$GLOBALS") (errors for existing roles are expected)"
  if is_enc "$GLOBALS"; then
    : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE required to decrypt $GLOBALS}"
    decrypt_from "$GLOBALS" | psql --dbname=postgres || log "globals reload had warnings (existing roles?) — continuing"
  else
    psql --dbname=postgres -f "$GLOBALS" || log "globals reload had warnings (existing roles?) — continuing"
  fi
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
if is_enc "$DUMP"; then
  : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE required to decrypt $DUMP}"
  decrypt_from "$DUMP" | pg_restore --no-owner --exit-on-error --dbname="$TARGET_DB"
else
  pg_restore --no-owner --exit-on-error --dbname="$TARGET_DB" "$DUMP"
fi

log "verifying core tables"
for tbl in ticket ticket_event sla_config user_role; do
  n="$(psql -tA -d "$TARGET_DB" -c "SELECT count(*) FROM \"$tbl\";" 2>/dev/null || echo '?')"
  log "  $tbl: $n rows"
done
log "RESTORE OK → $TARGET_DB"
