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

# Optional at-rest encryption. A dump holds the ENTIRE DB (hồ sơ + audit) and the
# globals hold cluster roles + PASSWORDS — so an unencrypted dump copied off-box is
# a full credential + data leak. With BACKUP_PASSPHRASE set, each artefact is
# AES-256-CBC (openssl, pbkdf2, salted) → *.enc; restore needs the same passphrase.
PASS="${BACKUP_PASSPHRASE:-}"
if [ -n "$PASS" ]; then
  command -v openssl >/dev/null 2>&1 || { echo "openssl not found — cannot encrypt backups" >&2; exit 1; }
fi

log() { echo "[pg-backup $(date -Is)] $*"; }

# Encrypt stdin → $1 with the passphrase (from env, never on the argv).
encrypt_to() { openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -out "$1"; }

# Keep only the newest $KEEP files matching a glob in $DIR; delete the rest.
prune() {
  ( cd "$DIR" && ls -1t $1 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f )
}

backup_once() {
  mkdir -p "$DIR"
  local ts db gl ext=""
  ts="$(date +%Y%m%d-%H%M%S)"
  [ -n "$PASS" ] && ext=".enc"
  db="$DIR/qlhs-$ts.dump$ext"
  gl="$DIR/globals-$ts.sql$ext"

  # Write to .partial then rename, so a crash mid-dump never leaves a truncated
  # file that a restore would trust. Explicit || guards catch a failed dump even
  # when set -e is disabled (this runs inside a `backup_once || …` caller).
  log "dumping database → $(basename "$db")${PASS:+ (mã hoá)}"
  if [ -n "$PASS" ]; then
    pg_dump --format=custom | encrypt_to "$db.partial" || { log "dump failed"; rm -f "$db.partial"; return 1; }
  else
    pg_dump --format=custom --file="$db.partial" || { log "dump failed"; rm -f "$db.partial"; return 1; }
  fi
  mv "$db.partial" "$db"

  log "dumping globals → $(basename "$gl")"
  if [ -n "$PASS" ]; then
    pg_dumpall --globals-only | encrypt_to "$gl.partial" || { log "globals dump failed"; rm -f "$gl.partial"; return 1; }
  else
    pg_dumpall --globals-only --file="$gl.partial" || { log "globals dump failed"; rm -f "$gl.partial"; return 1; }
  fi
  mv "$gl.partial" "$gl"

  # Globs match both plain (.dump/.sql) and encrypted (.enc) so rotation is uniform.
  prune 'qlhs-*.dump*'
  prune 'globals-*.sql*'
  log "done — $(ls -1 "$DIR"/qlhs-*.dump* 2>/dev/null | wc -l) backups retained (KEEP=$KEEP)"
}

[ -z "$PASS" ] && log "⚠ BACKUP_PASSPHRASE chưa set — backup KHÔNG mã hoá (dump chứa toàn bộ DB + mật khẩu role)."

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
