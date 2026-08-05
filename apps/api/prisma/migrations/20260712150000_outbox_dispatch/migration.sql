-- Story 5.2 — extend the notification outbox for the dispatcher: a status
-- lifecycle (pending → sent | failed), the recipient sub, retry bookkeeping,
-- and the last error. The UNIQUE (ticket_id, round_no, kind) from Epic 3 gives
-- idempotency (no double email across retries/rounds). AD-15 / M4.
ALTER TABLE "notification_outbox"
  ADD COLUMN "recipient_sub" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_error" TEXT;

CREATE INDEX "notification_outbox_status_created_at_idx"
  ON "notification_outbox"("status", "created_at");
