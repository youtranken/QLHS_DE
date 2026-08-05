-- CreateTable
CREATE TABLE "number_counter" (
    "prefix_year" TEXT NOT NULL,
    "next_seq" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "number_counter_pkey" PRIMARY KEY ("prefix_year")
);

-- CreateIndex (AD-20: code is globally unique; NULLs allowed pre-mint)
CREATE UNIQUE INDEX "ticket_code_key" ON "ticket"("code");
