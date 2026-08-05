-- CreateTable
CREATE TABLE "ticket_lock" (
    "ticket_id" TEXT NOT NULL,
    "holder_sub" TEXT NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_lock_pkey" PRIMARY KEY ("ticket_id")
);
