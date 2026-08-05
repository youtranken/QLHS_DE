-- The "Trạm của tôi" board loads in-flight tickets only (TicketQueryRepo.
-- listActiveByFlows: flow IN (...) AND status NOT IN (terminal)). This PARTIAL
-- index covers exactly those live rows, so the board query scans only active work
-- and its latency stays flat as the closed pile grows unbounded over the years.
CREATE INDEX IF NOT EXISTS "ticket_active_flow_idx"
  ON "ticket" ("flow")
  WHERE "status" NOT IN ('Completed', 'Sent to Accounting', 'Cancelled');
