-- F11 morning digest (7h30, business days, DCC roles only).
--
-- A separate outbox from notification_outbox on purpose: that table is per-TICKET
-- (its idempotency key is ticket+round+kind and its dispatcher joins ticket). A
-- digest is per-PERSON-per-DAY and spans many tickets, so it gets its own key.
-- UNIQUE (recipient, digest_date) IS the "at most one digest per person per day"
-- guarantee — enforced by the DB, not by scheduler timing.
CREATE TABLE "digest_outbox" (
  "id"              BIGSERIAL    PRIMARY KEY,
  "recipient_sub"   TEXT         NOT NULL,
  "digest_date"     DATE         NOT NULL,
  "status"          TEXT         NOT NULL DEFAULT 'pending',
  "attempts"        INTEGER      NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT now(),
  "sent_at"         TIMESTAMP(3),
  "last_error"      TEXT,
  "next_attempt_at" TIMESTAMP(3)
);

CREATE UNIQUE INDEX "digest_outbox_recipient_date_key" ON "digest_outbox" ("recipient_sub", "digest_date");
CREATE INDEX "digest_outbox_due_idx" ON "digest_outbox" ("status", "next_attempt_at");

-- Opt-OUT, not opt-in: the digest only ever fires when there is something to say,
-- so defaulting it on is useful rather than noisy — and one click turns it off.
ALTER TABLE "user" ADD COLUMN "digest_opt_out" BOOLEAN NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE ON "digest_outbox" TO qlhs_app;
GRANT USAGE, SELECT ON SEQUENCE "digest_outbox_id_seq" TO qlhs_app;
