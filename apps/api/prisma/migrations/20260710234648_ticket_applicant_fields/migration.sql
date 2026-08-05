-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "amount" BIGINT,
ADD COLUMN     "budget_code" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "contract_no" TEXT,
ADD COLUMN     "contractor" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "document_type" TEXT,
ADD COLUMN     "payment_term" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "project_team" TEXT;

-- CreateIndex
CREATE INDEX "ticket_applicant_sub_idx" ON "ticket"("applicant_sub");
