-- List/filter orders by seller or buyer with recent-first ordering.
-- Table name is "Order" (Prisma model Order without @@map) — see 20260411120000_squashed_init.
CREATE INDEX IF NOT EXISTS "Order_seller_id_created_at_idx" ON "Order" ("seller_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "Order_buyer_id_created_at_idx" ON "Order" ("buyer_id", "created_at" DESC);

-- Resolve paid checkout session → order
CREATE INDEX IF NOT EXISTS "checkout_sessions_order_id_idx" ON "checkout_sessions" ("order_id");

-- Shop catalog active products
CREATE INDEX IF NOT EXISTS "products_shop_id_is_active_idx" ON "products" ("shop_id", "is_active");
