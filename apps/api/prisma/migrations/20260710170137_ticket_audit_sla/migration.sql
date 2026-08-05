-- CreateTable
CREATE TABLE "ticket" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "applicant_sub" TEXT NOT NULL,
    "current_holder_sub" TEXT,
    "round_no" INTEGER NOT NULL DEFAULT 0,
    "status_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_event" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "actor_sub" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "round_no" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "ticket_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_config" (
    "status" TEXT NOT NULL,
    "flow" TEXT NOT NULL DEFAULT '*',
    "sla_days" INTEGER NOT NULL,
    "updated_by_sub" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_config_pkey" PRIMARY KEY ("status","flow")
);

-- CreateIndex
CREATE INDEX "ticket_status_flow_idx" ON "ticket"("status", "flow");

-- CreateIndex
CREATE INDEX "ticket_event_ticket_id_occurred_at_idx" ON "ticket_event"("ticket_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "ticket_event" ADD CONSTRAINT "ticket_event_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SLA days must be positive (B4)
ALTER TABLE "sla_config" ADD CONSTRAINT "sla_config_days_positive" CHECK ("sla_days" > 0);

-- Seed SLA thresholds (PRD §8.2 / DCC-Chart). Terminal statuses (Completed,
-- Sent to Accounting, Cancelled) get NO row — closed states carry no badge.
INSERT INTO "sla_config" ("status", "flow", "sla_days") VALUES
  ('Submitted', '*', 1),
  ('Submitted to VP Andy', '*', 1),
  ('Submitted to DCC2', '*', 1),
  ('Submitted to DCC3', '*', 1),
  ('Received by DCC2', '*', 2),
  ('Received by DCC3', '*', 2),
  ('Reopened', '*', 1),
  ('Returned', '*', 2),
  ('Return-fixing', '*', 3),
  ('Submitted to Accounting', 'Contract', 7),
  ('Received from ACC', 'Contract', 2),
  ('Submitted to BOP', 'Contract', 7),
  ('Submitted to DCC2 (Hardcopy)', 'Contract', 2),
  ('Hardcopy', 'Contract', 2),
  ('Submitted to BOP', 'General', 2);

-- Append-only enforcement (AD-4). A NON-owner app role so REVOKE actually bites
-- (the owner/superuser bypasses grants). Prod DATABASE_URL uses qlhs_app;
-- migrations run as the owner.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'qlhs_app') THEN
    CREATE ROLE qlhs_app LOGIN PASSWORD 'qlhs_app';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO qlhs_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qlhs_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qlhs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qlhs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO qlhs_app;

-- ticket_event is append-only: no UPDATE, no DELETE — ever.
REVOKE UPDATE, DELETE ON "ticket_event" FROM qlhs_app;
