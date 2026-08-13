#!/usr/bin/env bash
# Wipe all DOSSIER (ticket) data while KEEPING every catalog / config / user — for a
# clean slate before hand-over. Empties the hồ sơ tables (+ their audit, SLA, locks,
# notifications, outbox) and resets ticket numbering; leaves option_item (Document
# Type / Project-Team / Payment Term / Currency), sla_config, app_config, smtp_config,
# user, user_role, local_credential and processed_webhook_event untouched.
#
# DESTRUCTIVE + IRREVERSIBLE. It always takes a safety backup first (unless
# SKIP_BACKUP=1) and refuses to run unless CONFIRM=WIPE is set, so it can never fire
# by accident.
#
# MUST connect as the DB OWNER/superuser (default PGUSER=qlhs) — ticket_event is
# append-only (REVOKE + trigger) so the restricted app role qlhs_app CANNOT truncate
# it. Do NOT point this at qlhs_app.
#
#   Container (recommended, no host psql needed):
#       docker compose run --rm -e CONFIRM=WIPE -e PGPASSWORD="$POSTGRES_PASSWORD" \
#         pg-backup bash /ops/wipe-tickets.sh
#   Host (psql installed, port mapped on 127.0.0.1:5432):
#       PGHOST=localhost PGPASSWORD="$POSTGRES_PASSWORD" CONFIRM=WIPE \
#         ./ops/backup/wipe-tickets.sh
#
# Options:
#   KEEP_NUMBERING=1  keep number_counter → new codes CONTINUE from the last number
#                     (default: reset, so codes restart at ...-0001-<year>).
#   SKIP_BACKUP=1     skip the pre-wipe safety dump (NOT recommended).
set -euo pipefail

export PGHOST="${PGHOST:-postgres}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-qlhs}"
export PGPASSWORD="${PGPASSWORD:?PGPASSWORD required — pass the owner (qlhs) password via env/secret, no default}"
export PGDATABASE="${PGDATABASE:-qlhs}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"

log() { echo "[wipe-tickets $(date -Is)] $*"; }

if [ "${CONFIRM:-}" != "WIPE" ]; then
  echo "Refusing to run: set CONFIRM=WIPE to confirm you want to ERASE all ticket data" >&2
  echo "(catalogs, config and users are kept). See the header for usage." >&2
  exit 2
fi

# Ticket/dossier tables to empty. Catalogs/config/users are deliberately absent so
# they survive. number_counter is emptied last unless KEEP_NUMBERING=1.
TABLES=(
  ticket_event
  ticket
  ticket_sla_pause
  ticket_lock
  ticket_view
  notification
  notification_read
  notification_outbox
  digest_outbox
)
if [ "${KEEP_NUMBERING:-0}" != "1" ]; then
  TABLES+=(number_counter)
fi

# 1) Safety backup first — a full custom-format dump, so this wipe is undoable.
if [ "${SKIP_BACKUP:-0}" != "1" ]; then
  mkdir -p "$BACKUP_DIR"
  ts="$(date +%Y%m%d-%H%M%S)"
  out="$BACKUP_DIR/qlhs-pre-wipe-$ts.dump"
  log "safety backup → $out"
  pg_dump --format=custom --file="$out.partial"
  mv "$out.partial" "$out"
  log "backup done ($(du -h "$out" | cut -f1))"
else
  log "⚠ SKIP_BACKUP=1 — no safety dump taken"
fi

# 2) Empty the ticket tables in one transaction. RESTART IDENTITY resets sequences;
#    CASCADE handles the ticket_event/ticket_sla_pause FKs. Runs as the owner so the
#    append-only guard on ticket_event doesn't block it.
list="$(printf '"%s",' "${TABLES[@]}")"
list="${list%,}"
log "truncating: ${TABLES[*]}"
psql -v ON_ERROR_STOP=1 -c "TRUNCATE ${list} RESTART IDENTITY CASCADE;"

# 3) Verify: tickets gone, catalogs/config/users intact.
log "verifying…"
psql -v ON_ERROR_STOP=1 -At <<'SQL'
SELECT 'ticket (phải 0)           = ' || count(*) FROM ticket;
SELECT 'ticket_event (phải 0)     = ' || count(*) FROM ticket_event;
SELECT 'option_item (GIỮ)         = ' || count(*) FROM option_item;
SELECT 'sla_config (GIỮ)          = ' || count(*) FROM sla_config;
SELECT 'user_role (GIỮ)           = ' || count(*) FROM user_role;
SELECT '"user" (GIỮ)              = ' || count(*) FROM "user";
SQL

log "✔ done — dossiers wiped, catalogs/config/users kept."
