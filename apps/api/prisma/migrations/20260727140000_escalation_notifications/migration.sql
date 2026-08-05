-- 2.5 SLA escalation ladder. Escalations are written into the SAME notification
-- table as 2.2 (so they show on the bell and auto-resolve when the ticket leaves
-- the station), but by an hourly scheduler rather than the transition trigger.
--
-- The scheduler runs every hour, so it must not re-post the same escalation each
-- time. This partial unique index makes at most ONE row per (ticket, tier,
-- station): a tier fires once while the ticket sits at a station, and re-arms
-- only when the ticket moves (waiting_status changes) or climbs to a higher tier
-- (a different kind). Scoped to the escalation kinds so ordinary 2.2
-- notifications — which legitimately repeat (e.g. Returned across rounds) — are
-- untouched.
CREATE UNIQUE INDEX "notification_escalation_uq"
  ON "notification" ("ticket_id", "kind", "waiting_status")
  WHERE "kind" IN ('EscalateWarn', 'EscalateOverdue', 'EscalateCritical');
