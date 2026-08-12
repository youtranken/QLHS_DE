-- Append-only for the webhook idempotency ledger (MED-5 / finding B4). `qlhs_app`
-- still held UPDATE/DELETE on this table via ALTER DEFAULT PRIVILEGES, so a bug or a
-- compromised app role could rewrite/erase the dedup ledger and let an offboarding
-- webhook replay be processed twice. The app only INSERTs (ON CONFLICT DO NOTHING) +
-- SELECTs this table, so revoking mutate rights closes the gap with ZERO functional
-- impact. (ticket_event is locked the same way plus a trigger; this lower-stakes
-- ledger uses REVOKE alone.) Runs as the owner at migrate-deploy, so it can revoke
-- from the app role; the app then simply lacks a privilege it never used.
REVOKE UPDATE, DELETE ON "processed_webhook_event" FROM qlhs_app;
