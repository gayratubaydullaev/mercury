-- CreateTable
CREATE TABLE "order_audit_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_audit_events_order_id_created_at_idx" ON "order_audit_events"("order_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "order_audit_events" ADD CONSTRAINT "order_audit_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
