-- Code-review fix (Epic 3 #1): distinguish WHY a ticket bounced to DCC1's
-- reconcile lane — 'missing_paper' (re-hand over) vs 'return_requested' (Return).
-- This gives DCC2's "đẩy ngược DCC1" push-back a DCC1 surface + a completion
-- lockout, closing AC4.
ALTER TABLE "ticket" ADD COLUMN "reconcile_reason" TEXT;
