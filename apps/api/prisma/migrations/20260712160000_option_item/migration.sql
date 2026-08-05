-- Admin-managed dropdown values for the create-ticket form (N3): Payment Term /
-- Project Team. Values are never deleted (old tickets keep their string) — only
-- deactivated, hiding them from new forms. `kind` groups the two lists.
CREATE TABLE "option_item" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "option_item_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "option_item_kind_value_key" ON "option_item"("kind", "value");
CREATE INDEX "option_item_kind_active_sort_order_idx" ON "option_item"("kind", "active", "sort_order");

-- The app connects as the restricted role; grant it CRUD on this mutable table
-- (matches the ticket_view/notification_outbox pattern). No UPDATE/DELETE revoke
-- here — options are admin-editable, unlike the append-only ticket_event.
GRANT SELECT, INSERT, UPDATE, DELETE ON "option_item" TO qlhs_app;
