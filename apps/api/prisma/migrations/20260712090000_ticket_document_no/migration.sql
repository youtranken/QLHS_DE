-- Document No (FR-11/FR-13, AD-20/M5): a contract number DCC2/DCC3 enter before
-- sending to Accounting. Globally unique across flows, EXCLUDING Cancelled tickets
-- (a cancelled file releases its number for reuse). The partial WHERE can't be
-- expressed in the Prisma schema, so the index lives here.
ALTER TABLE "ticket" ADD COLUMN "document_no" TEXT;

CREATE UNIQUE INDEX "ticket_document_no_active_key"
  ON "ticket" ("document_no")
  WHERE "document_no" IS NOT NULL AND "status" <> 'Cancelled';
