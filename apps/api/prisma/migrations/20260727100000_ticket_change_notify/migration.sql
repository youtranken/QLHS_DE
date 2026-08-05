-- 2.1 real-time: a trigger is the only choke point that catches every status
-- writer (six repos) at once — the same reason pause-close and ticket_event use
-- one. On any new ticket or status change it emits a NOTIFY the API relays to
-- connected browsers over SSE, so boards stop polling every 4 seconds.
--
-- pg_notify payloads are capped at 8000 bytes: we send only id/flow/status, a
-- signal to refetch, never a full ticket.
CREATE OR REPLACE FUNCTION notify_ticket_change() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'qlhs_ticket',
    json_build_object('id', NEW."id", 'flow', NEW."flow", 'status', NEW."status")::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ticket_notify_insert
  AFTER INSERT ON "ticket"
  FOR EACH ROW EXECUTE FUNCTION notify_ticket_change();

CREATE TRIGGER ticket_notify_status
  AFTER UPDATE OF "status" ON "ticket"
  FOR EACH ROW
  WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION notify_ticket_change();
