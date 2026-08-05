-- 2.1 SSE scoping: carry applicant_sub in the change payload so the API can
-- filter the firehose per viewer — a plain Applicant must only receive changes
-- to their OWN tickets, not every ticket's state (cross-applicant metadata leak).
-- Still well under the 8000-byte pg_notify cap; the API strips applicant_sub
-- before relaying to the browser (the client payload stays id/flow/status).
CREATE OR REPLACE FUNCTION notify_ticket_change() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'qlhs_ticket',
    json_build_object(
      'id', NEW."id",
      'flow', NEW."flow",
      'status', NEW."status",
      'applicantSub', NEW."applicant_sub"
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
