-- Runtime send-time for the F11 morning digest, editable from Admin › Cấu hình.
-- Singleton row (id=1); default 07:30 keeps the prior hard-coded behaviour.
CREATE TABLE "digest_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hour" INTEGER NOT NULL DEFAULT 7,
    "minute" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    CONSTRAINT "digest_config_pkey" PRIMARY KEY ("id")
);

-- Mutable config (upserted, never deleted) — the app role reads and writes it.
GRANT SELECT, INSERT, UPDATE ON "digest_config" TO qlhs_app;
