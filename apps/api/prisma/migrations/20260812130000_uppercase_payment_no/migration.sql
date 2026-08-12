-- Payment No is now stored UPPERCASE, symmetric with Contract No (MED-2). Storing
-- it verbatim left `ticket_payment_no_active_key` case-SENSITIVE, so two live Payment
-- tickets could hold the same real number differing only in case ('pmt-a1' vs
-- 'PMT-A1') — the exact 1-1 violation the split was meant to prevent. Bring legacy
-- data in line so the case-insensitive write path can't clash with old rows.

-- Fail LOUD if two live Payment tickets already collide when uppercased, naming the
-- count so an operator reconciles before deploy (mirrors the split migration guard);
-- otherwise the UPDATE below would fail mid-migration on the unique index.
DO $$
DECLARE dup int;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT 1 FROM "ticket"
    WHERE "flow" = 'Payment' AND "status" <> 'Cancelled'
      AND "payment_no" IS NOT NULL AND "payment_no" <> 'N/A'
    GROUP BY UPPER("payment_no") HAVING count(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE EXCEPTION 'Uppercase Payment No blocked: % Payment No value(s) collide when uppercased among live Payment tickets. Reconcile case-variant Payment Nos, then re-run.', dup;
  END IF;
END $$;

-- Idempotent: already-uppercase rows are skipped, so a re-run is a no-op.
UPDATE "ticket" SET "payment_no" = UPPER("payment_no")
  WHERE "payment_no" IS NOT NULL AND "payment_no" <> UPPER("payment_no");
