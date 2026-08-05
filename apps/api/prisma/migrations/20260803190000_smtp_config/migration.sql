-- Runtime SMTP config editable from the admin UI (Cấu hình › Email). Singleton
-- row (id=1); password stored AES-256-GCM encrypted in password_enc.
CREATE TABLE "smtp_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "host" TEXT,
    "port" INTEGER,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "password_enc" TEXT,
    "from_addr" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    CONSTRAINT "smtp_config_pkey" PRIMARY KEY ("id")
);

-- The app role reads AND writes this config (it is mutable — unlike the
-- append-only ticket_event/notification ledgers). No DELETE (a singleton is
-- upserted, never removed).
GRANT SELECT, INSERT, UPDATE ON "smtp_config" TO qlhs_app;
