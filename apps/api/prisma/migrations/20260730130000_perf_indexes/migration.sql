-- Scale/perf indexes. No schema/behaviour change — only read-path support.

-- The append-only ticket_event table is the busiest read target and grows without
-- bound, yet had only (ticket_id, occurred_at). These back the admin audit's
-- ORDER BY occurred_at DESC, id DESC and its action / actor_sub filters + groupBy.
CREATE INDEX "ticket_event_occurred_at_id_idx" ON "ticket_event" ("occurred_at" DESC, "id" DESC);
CREATE INDEX "ticket_event_action_idx" ON "ticket_event" ("action");
CREATE INDEX "ticket_event_actor_sub_idx" ON "ticket_event" ("actor_sub");

-- "Held by me" boards + the morning digest scan tickets by their current holder.
CREATE INDEX "ticket_current_holder_sub_idx" ON "ticket" ("current_holder_sub");

-- Closed-ticket search filters by status and orders by status_entered_at.
CREATE INDEX "ticket_status_status_entered_at_idx" ON "ticket" ("status", "status_entered_at");
