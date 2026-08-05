-- Story 3.4: Contract Hardcopy → Completed.
-- scan_path: path to the scanned hardcopy on the shared drive (FR-12/M10) — a
-- string only, never a file attachment.
ALTER TABLE "ticket" ADD COLUMN "scan_path" TEXT;

-- Notification outbox (AD-15/M4): completion/return intents written in the same
-- transaction as the transition; the Epic 5 dispatcher sends them. The partial
-- unique (ticket, round, kind) gives at-least-once idempotency.
CREATE TABLE "notification_outbox" (
    "id"         BIGSERIAL NOT NULL,
    "ticket_id"  TEXT NOT NULL,
    "round_no"   INTEGER NOT NULL,
    "kind"       TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at"    TIMESTAMP(3),
    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_outbox_ticket_round_kind_key"
  ON "notification_outbox" ("ticket_id", "round_no", "kind");

-- The app connects as the restricted role; it writes intents and (Epic 5) marks
-- them sent.
GRANT SELECT, INSERT, UPDATE ON "notification_outbox" TO qlhs_app;
GRANT USAGE, SELECT ON SEQUENCE "notification_outbox_id_seq" TO qlhs_app;
