-- Local (non-SSO) credentials for the break-glass Admin/SA.
CREATE TABLE "local_credential" (
    "sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "local_credential_pkey" PRIMARY KEY ("sub")
);
CREATE UNIQUE INDEX "local_credential_email_key" ON "local_credential"("email");

-- The app connects as the restricted role; grant it CRUD on this table.
GRANT SELECT, INSERT, UPDATE, DELETE ON "local_credential" TO qlhs_app;
