-- Per-viewer "seen" state (AD-18, Story 5.3). One row per (ticket, viewer sub);
-- opening a ticket upserts last_viewed_at. The "unseen >24h" badge is derived at
-- read time (AD-6, no stored flag). Server-side → consistent across devices.
CREATE TABLE "ticket_view" (
    "ticket_id" TEXT NOT NULL,
    "viewer_sub" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ticket_view_pkey" PRIMARY KEY ("ticket_id", "viewer_sub")
);

-- The app connects as the restricted role; grant it CRUD on this table (matches
-- the notification_outbox/local_credential pattern; default privileges also cover
-- it, but be explicit for fresh-DB reproducibility).
GRANT SELECT, INSERT, UPDATE, DELETE ON "ticket_view" TO qlhs_app;
