-- Explicit grant for the app role, matching the convention used by every other
-- table (ticket_view, option_item…). Default privileges already cover a table
-- created by the owner, but an on-prem deploy that migrates under a different
-- owner would silently leave the app unable to write — so state it outright.
GRANT SELECT, INSERT, UPDATE ON "ticket_sla_pause" TO qlhs_app;
GRANT USAGE, SELECT ON SEQUENCE "ticket_sla_pause_id_seq" TO qlhs_app;
