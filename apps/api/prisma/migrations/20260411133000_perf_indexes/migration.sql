-- List/filter orders by seller or buyer with recent-first ordering
CREATE INDEX IF NOT EXISTS "orders_seller_id_created_at_idx" ON "orders" ("seller_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "orders_buyer_id_created_at_idx" ON "orders" ("buyer_id", "created_at" DESC);

-- Resolve paid checkout session → order
CREATE INDEX IF NOT EXISTS "checkout_sessions_order_id_idx" ON "checkout_sessions" ("order_id");

-- Shop catalog active products
CREATE INDEX IF NOT EXISTS "products_shop_id_is_active_idx" ON "products" ("shop_id", "is_active");
