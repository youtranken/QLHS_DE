-- Split the single `document_no` into two flow-specific fields (FR-11/FR-13):
--   * contract_no — Contract No. Contract flow = DCC2-assigned; Payment flow =
--     Applicant-entered reference to the contract being paid (a contract may be
--     referenced by MANY payments); General = 'N/A'. Always stored UPPERCASE.
--   * payment_no  — Payment No. Payment flow = DCC3-assigned; else null.
-- Uniqueness (AD-20/M5): Contract No unique among Contract tickets; Payment No
-- unique among Payment tickets. Payment's contract_no reference is NOT unique
-- (many payments per contract). All partial, excluding the 'N/A' sentinel and
-- Cancelled tickets (a withdrawn file releases its numbers for reuse).

ALTER TABLE "ticket" ADD COLUMN "payment_no" TEXT;

-- Move legacy DCC-entered numbers into the right column by flow. Contract rows
-- carried the number in document_no (contract_no was the 'N/A' applicant slot — the
-- create UI locks it, so no real applicant value is clobbered); Payment rows carried
-- the DCC3 number in document_no (contract_no already holds the Applicant's reference
-- and is preserved).
UPDATE "ticket" SET "contract_no" = "document_no"
  WHERE "flow" = 'Contract' AND "document_no" IS NOT NULL;
UPDATE "ticket" SET "payment_no" = "document_no"
  WHERE "flow" = 'Payment' AND "document_no" IS NOT NULL;

-- The retired document_no index was case-SENSITIVE, so two live Contract tickets
-- could hold numbers differing only by case ('HD-01' vs 'hd-01'). Uppercasing (next
-- step) would collapse them and the new unique index would then fail mid-migration
-- with a cryptic error. Fail LOUD here instead, naming the collision so an operator
-- can reconcile the data before deploying.
DO $$
DECLARE dup int;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT 1 FROM "ticket"
    WHERE "flow" = 'Contract' AND "status" <> 'Cancelled'
      AND "contract_no" IS NOT NULL AND "contract_no" <> 'N/A'
    GROUP BY UPPER("contract_no") HAVING count(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'Split migration blocked: % Contract No value(s) collide when uppercased among live Contract tickets. Reconcile case-variant Contract Nos, then re-run.', dup;
  END IF;
END $$;

-- Contract No is normalised to uppercase everywhere it is entered — bring legacy
-- data in line before the unique index below is built.
UPDATE "ticket" SET "contract_no" = UPPER("contract_no") WHERE "contract_no" IS NOT NULL;

-- Retire the single-column model.
DROP INDEX IF EXISTS "ticket_document_no_active_key";
ALTER TABLE "ticket" DROP COLUMN "document_no";

-- Contract No unique among live Contract tickets (the owning side). Payment's
-- reference is deliberately NOT constrained — one contract, many payments.
CREATE UNIQUE INDEX "ticket_contract_no_contract_key"
  ON "ticket" ("contract_no")
  WHERE "flow" = 'Contract' AND "contract_no" IS NOT NULL
        AND "contract_no" <> 'N/A' AND "status" <> 'Cancelled';

-- Payment No unique among live Payment tickets.
CREATE UNIQUE INDEX "ticket_payment_no_active_key"
  ON "ticket" ("payment_no")
  WHERE "flow" = 'Payment' AND "payment_no" IS NOT NULL
        AND "payment_no" <> 'N/A' AND "status" <> 'Cancelled';
