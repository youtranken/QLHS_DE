#!/usr/bin/env bash
# 1.5 — prove a backup actually restores. An untested backup is not a backup.
# Restores one dump into a throwaway database in the same cluster, checks that
# core tables came back, then drops it. Roles (qlhs_app) already exist in this
# cluster, so globals need not be reloaded for the data check.
#
#   From the host:      PGHOST=localhost PGPORT=5432 ./ops/backup/test-restore.sh data-backups/qlhs-YYYYMMDD-HHMMSS.dump
#   Via the container:  docker compose run --rm pg-backup bash /ops/test-restore.sh /backups/qlhs-YYYYMMDD-HHMMSS.dump
set -euo pipefail

DUMP="${1:?usage: test-restore.sh <path-to-qlhs-*.dump>}"
export PGHOST="${PGHOST:-postgres}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-qlhs}"
# No weak default — supply the DB password via env/secret (vbsec MEDIUM).
export PGPASSWORD="${PGPASSWORD:?PGPASSWORD required — pass it via env/secret, no default}"

# Encrypted (*.enc) dumps decrypt on the fly with BACKUP_PASSPHRASE.
is_enc() { case "$1" in *.enc) return 0 ;; *) return 1 ;; esac; }

TMPDB="qlhs_restore_test_$(date +%s)"

echo "==> creating scratch database $TMPDB"
createdb "$TMPDB"
trap 'dropdb --if-exists "$TMPDB" >/dev/null 2>&1 && echo "==> dropped $TMPDB"' EXIT

echo "==> restoring $(basename "$DUMP") → $TMPDB"
# --no-owner: reassign to the connecting user; role GRANTs still target qlhs_app,
# which exists cluster-wide. Exit non-zero only on real errors (not GRANT notices).
if is_enc "$DUMP"; then
  : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE required to decrypt $DUMP}"
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "$DUMP" \
    | pg_restore --no-owner --exit-on-error --dbname="$TMPDB"
else
  pg_restore --no-owner --exit-on-error --dbname="$TMPDB" "$DUMP"
fi

for tbl in ticket ticket_event sla_config user_role; do
  n="$(psql -tA -d "$TMPDB" -c "SELECT count(*) FROM \"$tbl\";")"
  echo "    $tbl: $n rows"
done
echo "==> RESTORE OK"
