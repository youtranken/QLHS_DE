#!/usr/bin/env bash
# 1.5 — nightly full backup of the QLHS Postgres, kept as a rolling window.
# Runs inside a postgres:18 container (has pg_dump/pg_dumpall) beside the DB.
#
# Two artefacts per run so a restore is SELF-CONTAINED:
#   qlhs-<ts>.dump    full database, custom format (compressed). Captures
#                     everything that lives in the DB: hồ sơ + audit
#                     (ticket, ticket_event) AND every rule/config —
#                     sla_config, option_item, user_role, local_credential,
#                     notification, digest_outbox, …
#   globals-<ts>.sql  cluster roles + passwords (qlhs / qlhs_app). A single-db
#                     dump does NOT include global roles, but the schema's GRANTs
#                     reference qlhs_app — without this a restore onto a blank
#                     cluster fails on those GRANTs.
set -euo pipefail

DIR="${BACKUP_DIR:-/backups}"
KEEP="${KEEP:-30}"
BACKUP_HOUR="${BACKUP_HOUR:-2}"

export PGHOST="${PGHOST:-postgres}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-qlhs}"
# No weak default — the DB password must come from the env/secret store. A baked
# `qlhs` fallback would silently ship the guessable credential (vbsec MEDIUM).
export PGPASSWORD="${PGPASSWORD:?PGPASSWORD required — pass it via env/secret, no default}"
export PGDATABASE="${PGDATABASE:-qlhs}"

log() { echo "[pg-backup $(date -Is)] $*"; }

# Keep only the newest $KEEP files matching a glob in $DIR; delete the rest.
prune() {
  ( cd "$DIR" && ls -1t $1 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f )
}

backup_once() {
  mkdir -p "$DIR"
  local ts db gl
  ts="$(date +%Y%m%d-%H%M%S)"
  db="$DIR/qlhs-$ts.dump"
  gl="$DIR/globals-$ts.sql"

  # Write to .partial then rename, so a crash mid-dump never leaves a truncated
  # file that a restore would trust.
  log "dumping database → $(basename "$db")"
  pg_dump --format=custom --file="$db.partial"
  mv "$db.partial" "$db"

  log "dumping globals → $(basename "$gl")"
  pg_dumpall --globals-only --file="$gl.partial"
  mv "$gl.partial" "$gl"

  prune 'qlhs-*.dump'
  prune 'globals-*.sql'
  log "done — $(ls -1 "$DIR"/qlhs-*.dump 2>/dev/null | wc -l) backups retained (KEEP=$KEEP)"
}

# One-shot mode (BACKUP_ON_START=1) — used by the first run and by tests.
if [ "${BACKUP_ON_START:-0}" = "1" ]; then
  backup_once || log "startup backup FAILED"
fi
if [ "${RUN_ONCE:-0}" = "1" ]; then
  exit 0
fi

log "scheduler up — daily at ${BACKUP_HOUR}:00, keeping $KEEP rolling"
while true; do
  now="$(date +%s)"
  target="$(date -d "today ${BACKUP_HOUR}:00" +%s)"
  [ "$target" -le "$now" ] && target="$(date -d "tomorrow ${BACKUP_HOUR}:00" +%s)"
  sleep "$((target - now))"
  # A single failed run must not kill the loop — log and try again next cycle.
  backup_once || log "scheduled backup FAILED — retrying next cycle"
done
