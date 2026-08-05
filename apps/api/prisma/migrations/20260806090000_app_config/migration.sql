-- App-wide mutable display settings, editable from admin (Cấu hình › Tên VP).
-- Singleton row (id=1). The VP display name lives here so a rename touches one
-- place; the canonical status "Submitted to VP Andy" in the state machine/audit
-- is untouched.
CREATE TABLE "app_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "vp_name" TEXT NOT NULL DEFAULT 'Andy',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton so GET has a row from day one (defaults to Andy).
INSERT INTO "app_config" ("id", "vp_name", "updated_at") VALUES (1, 'Andy', NOW())
ON CONFLICT ("id") DO NOTHING;

-- App role reads AND writes this mutable config (like smtp_config). No DELETE.
GRANT SELECT, INSERT, UPDATE ON "app_config" TO qlhs_app;
