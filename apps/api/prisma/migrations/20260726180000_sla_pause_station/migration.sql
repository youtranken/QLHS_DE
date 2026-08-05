-- F8 oversight: record WHICH station the clock was stopped at, at the moment it
-- was stopped. Reading `ticket.status` at report time would misattribute every
-- resumed pause, because the ticket has since moved on to another station.
ALTER TABLE "ticket_sla_pause" ADD COLUMN "status" TEXT;

-- Backfill: for rows still open this is exact (a pause never moves a ticket);
-- for already-resumed rows it is the best available guess, and those are dev-only.
UPDATE "ticket_sla_pause" p
   SET "status" = t."status"
  FROM "ticket" t
 WHERE t."id" = p."ticket_id" AND p."status" IS NULL;

ALTER TABLE "ticket_sla_pause" ALTER COLUMN "status" SET NOT NULL;

-- The station report groups by status over a recent window.
CREATE INDEX "ticket_sla_pause_status_idx" ON "ticket_sla_pause" ("status", "paused_at");
