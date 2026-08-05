-- 2-phase handover (AD-10, Story 3.1): DCC2's "missing paper" bounce keeps the
-- ticket's status but flags it back to DCC1's queue for reconciliation.
ALTER TABLE "ticket" ADD COLUMN "reconcile_flag" BOOLEAN NOT NULL DEFAULT false;
