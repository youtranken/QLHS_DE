-- F8 "chờ bổ sung": the SLA clock stops while a ticket waits on something outside
-- the office. A pause is NOT a station, so the ticket keeps its status and this
-- table stays out of the state machine entirely (AD-2 untouched).
--
-- This table is also the audit record for the pause itself — who stopped the
-- clock, why, and who restarted it. It deliberately does NOT write ticket_event:
-- that log has exactly one writer, transition() (AD-4), and no status changed here.
CREATE TABLE "ticket_sla_pause" (
  "id"             BIGSERIAL    PRIMARY KEY,
  "ticket_id"      TEXT         NOT NULL,
  "paused_at"      TIMESTAMP(3) NOT NULL DEFAULT now(),
  "resumed_at"     TIMESTAMP(3),
  "reason"         TEXT         NOT NULL,
  "paused_by_sub"  TEXT         NOT NULL,
  "resumed_by_sub" TEXT,
  CONSTRAINT "ticket_sla_pause_ticket_fk" FOREIGN KEY ("ticket_id")
    REFERENCES "ticket"("id") ON DELETE CASCADE
);

CREATE INDEX "ticket_sla_pause_ticket_idx" ON "ticket_sla_pause" ("ticket_id", "paused_at");

-- At most one OPEN pause per ticket: a second "pause" while already paused would
-- double-count forgiven days and is a bug, not a workflow.
CREATE UNIQUE INDEX "ticket_sla_pause_one_open" ON "ticket_sla_pause" ("ticket_id")
  WHERE "resumed_at" IS NULL;
