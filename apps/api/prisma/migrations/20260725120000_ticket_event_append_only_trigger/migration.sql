-- AD-4 append-only, enforced independently of table ownership.
--
-- The GRANT/REVOKE in 20260710170137 only bites when the app role is NOT the
-- table owner (a Postgres owner bypasses its own REVOKE). Since the repo ships a
-- single DATABASE_URL (qlhs_app), a bootstrap that runs migrations as qlhs_app
-- would make it the owner and silently re-enable UPDATE/DELETE on the audit.
--
-- This trigger removes that dependency: it blocks UPDATE/DELETE for ANY
-- non-superuser role — even one holding an explicit GRANT or owning the table —
-- because the application role (qlhs_app) is never a superuser. A superuser
-- DBA/migration keeps the ability to run surgical corrections (and the test
-- harness to reset state). The sole legitimate writer stays transition() via
-- INSERT; this only forbids mutating what was written.
CREATE OR REPLACE FUNCTION ticket_event_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('is_superuser') = 'off' THEN
    RAISE EXCEPTION 'ticket_event is append-only (AD-4): % is not permitted', TG_OP
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_event_append_only ON "ticket_event";
CREATE TRIGGER ticket_event_append_only
  BEFORE UPDATE OR DELETE ON "ticket_event"
  FOR EACH ROW EXECUTE FUNCTION ticket_event_append_only();
