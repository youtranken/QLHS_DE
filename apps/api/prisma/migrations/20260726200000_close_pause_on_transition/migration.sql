-- F8 fix: an open pause must not outlive the station it was opened at.
--
-- Before this, nothing closed a pause when the ticket moved on. The SLA maths
-- ignored the stale window (windowsFor filters on status_entered_at) so the UI
-- said "not paused" and offered Pause, while openFor() still saw the row and
-- rejected every attempt with 409 — for the rest of the ticket's life, because
-- the partial unique index forbids a second open row. The Admin report kept
-- counting it as a stopped clock forever.
--
-- Enforced by trigger rather than in a use-case: SIX repos write status changes
-- (ticket-transition, handover, confirm-flow, accounting, complete-contract,
-- lock), so any application-level fix would be one forgotten call site away from
-- the same bug. Same reasoning as the ticket_event append-only trigger.
--
-- resumed_by_sub stays NULL: nobody resumed it, the move did. That reads
-- honestly in the Admin report and keeps user references to real subs (AD-7).
CREATE OR REPLACE FUNCTION close_sla_pause_on_status_change() RETURNS TRIGGER AS $$
BEGIN
  UPDATE "ticket_sla_pause"
     SET "resumed_at" = now()
   WHERE "ticket_id" = NEW."id" AND "resumed_at" IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_close_sla_pause
  AFTER UPDATE OF "status" ON "ticket"
  FOR EACH ROW
  WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION close_sla_pause_on_status_change();
