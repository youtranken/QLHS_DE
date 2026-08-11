-- Data heal for the "check-at-receipt" handover redesign.
--
-- The old model let DCC2 push a wrong hardcopy back AFTER confirming receipt,
-- flagging the ticket (reconcile_flag=true) status-preserving at `Received by
-- DCC2` / `Hardcopy`. Those after-receipt sendBack edges were removed, so a
-- legacy ticket left flagged at one of those states would deadlock: RESEND,
-- RETURN and Complete all reject (no edge / wrong allowed-from state).
--
-- The new rule is "once a DCC confirms receipt it has accepted the paper", so a
-- reconcile flag on an after-receipt state is no longer valid — clear it and let
-- the ticket proceed normally. Idempotent: touches only still-flagged rows at
-- those states (typically zero — the flag was a transient in-flight state).
UPDATE "ticket"
SET "reconcile_flag" = false,
    "reconcile_reason" = NULL
WHERE "reconcile_flag" = true
  AND "status" IN ('Received by DCC2', 'Hardcopy', 'Received by DCC3');
