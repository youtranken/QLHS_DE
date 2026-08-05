-- AD-15/M4 backoff: park a failed outbox row until `next_attempt_at` so a
-- transient SMTP outage is retried with exponential backoff (not every 15s) and
-- survives far longer than the old 5-quick-retries window before parking failed.
ALTER TABLE "notification_outbox" ADD COLUMN "next_attempt_at" TIMESTAMP(3);
CREATE INDEX "notification_outbox_status_next_attempt_at_idx"
  ON "notification_outbox" ("status", "next_attempt_at");
