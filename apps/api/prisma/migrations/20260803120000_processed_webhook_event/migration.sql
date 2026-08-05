-- PMH ID offboarding webhook idempotency ledger. One row per delivered event_id
-- so an at-least-once retry / replay is a no-op. App role only appends + reads.
CREATE TABLE "processed_webhook_event" (
  "event_id"    TEXT         PRIMARY KEY,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON "processed_webhook_event" TO qlhs_app;
