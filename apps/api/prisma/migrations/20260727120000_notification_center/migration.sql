-- 2.2 notification center. Two tables:
--   notification       — one row PER EVENT (never fanned out per user)
--   notification_read  — per-user read marks, so "read" is personal
--
-- Written by a trigger, not app code, for the same reason as pause-close and the
-- SSE NOTIFY: a status change can arrive through any of six repos, and a
-- notification that a use-case forgot to write is worse than none. The trigger
-- runs INSIDE the transition's transaction, so the row is atomic with the status
-- change — exactly the "same transaction as the outbox" guarantee we want.
--
-- Addressed EITHER to a person (recipient_sub) OR a role inbox (recipient_role),
-- never both. Role notifications carry waiting_status: the read side treats them
-- as resolved once the ticket leaves that station, so a shared DCC inbox is not
-- nagged forever after one person picks the ticket up.

CREATE TABLE "notification" (
  "id"             BIGSERIAL    PRIMARY KEY,
  "ticket_id"      TEXT         NOT NULL,
  "code"           TEXT,
  "recipient_sub"  TEXT,
  "recipient_role" TEXT,
  "kind"           TEXT         NOT NULL,
  "waiting_status" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "notification_one_target"
    CHECK (("recipient_sub" IS NOT NULL) <> ("recipient_role" IS NOT NULL))
);

CREATE INDEX "notification_sub_idx" ON "notification" ("recipient_sub", "created_at" DESC);
CREATE INDEX "notification_role_idx" ON "notification" ("recipient_role", "created_at" DESC);

CREATE TABLE "notification_read" (
  "notification_id" BIGINT       NOT NULL REFERENCES "notification"("id") ON DELETE CASCADE,
  "sub"             TEXT         NOT NULL,
  "read_at"         TIMESTAMP(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("notification_id", "sub")
);

-- The role map is the two-phase handover waiting states (holder null) — the same
-- set the digest calls awaitingStatusesFor. If a new such state is added, update
-- BOTH this CASE and domain/ticket/state-machine/state-owner.ts.
CREATE OR REPLACE FUNCTION notify_center_on_change() RETURNS TRIGGER AS $$
DECLARE
  target_role TEXT;
BEGIN
  IF NEW."status" IN ('Completed', 'Returned') THEN
    INSERT INTO "notification" ("ticket_id", "code", "recipient_sub", "kind")
    VALUES (NEW."id", NEW."code", NEW."applicant_sub", NEW."status");
    RETURN NEW;
  END IF;

  -- Role names are the canonical ROLE values (packages/contracts/src/role.ts): uppercase.
  target_role := CASE NEW."status"
    WHEN 'Submitted' THEN 'DCC1'
    WHEN 'Submitted to DCC2' THEN 'DCC2'
    WHEN 'Submitted to DCC2 (Hardcopy)' THEN 'DCC2'
    WHEN 'Submitted to DCC3' THEN 'DCC3'
    ELSE NULL
  END;
  IF target_role IS NOT NULL THEN
    INSERT INTO "notification" ("ticket_id", "code", "recipient_role", "kind", "waiting_status")
    VALUES (NEW."id", NEW."code", target_role, NEW."status", NEW."status");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_center_insert
  AFTER INSERT ON "ticket"
  FOR EACH ROW EXECUTE FUNCTION notify_center_on_change();

CREATE TRIGGER notification_center_status
  AFTER UPDATE OF "status" ON "ticket"
  FOR EACH ROW
  WHEN (OLD."status" IS DISTINCT FROM NEW."status")
  EXECUTE FUNCTION notify_center_on_change();

GRANT SELECT, INSERT ON "notification" TO qlhs_app;
GRANT USAGE, SELECT ON SEQUENCE "notification_id_seq" TO qlhs_app;
GRANT SELECT, INSERT ON "notification_read" TO qlhs_app;
