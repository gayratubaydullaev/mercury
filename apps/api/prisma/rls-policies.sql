-- Row Level Security policies for MyShopUZ
-- Run this after migrations on PostgreSQL (e.g. in a separate migration or manually)
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Set role for current request (application sets this via SET LOCAL role_id / role)
-- Example: SELECT set_config('app.current_user_id', 'uuid', true);

-- Users: own row or ADMIN
CREATE POLICY users_select_own ON users FOR SELECT
  USING (id = current_setting('app.current_user_id', true)::uuid OR current_setting('app.user_role', true) = 'ADMIN');
CREATE POLICY users_update_own ON users FOR UPDATE
  USING (id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY users_all_admin ON users FOR ALL
  USING (current_setting('app.user_role', true) = 'ADMIN');

-- Products: public read active+moderated; seller own CRUD; admin all
CREATE POLICY products_select_public ON products FOR SELECT
  USING (is_active = true AND is_moderated = true);
CREATE POLICY products_seller_own ON products FOR ALL
  USING (shop_id IN (SELECT id FROM shops WHERE user_id = current_setting('app.current_user_id', true)::uuid));
CREATE POLICY products_admin ON products FOR ALL
  USING (current_setting('app.user_role', true) = 'ADMIN');

-- Orders: buyer sees own; seller sees own shop orders; admin all
CREATE POLICY orders_buyer ON orders FOR SELECT
  USING (buyer_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY orders_seller ON orders FOR SELECT
  USING (seller_id = current_setting('app.current_user_id', true)::uuid);
CREATE POLICY orders_admin ON orders FOR ALL
  USING (current_setting('app.user_role', true) = 'ADMIN');

-- Cart: own cart only
CREATE POLICY cart_own ON carts FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid OR session_id = current_setting('app.session_id', true));

-- Cart items: same as cart (cart must be visible to user)
CREATE POLICY cart_items_own ON cart_items FOR ALL
  USING (cart_id IN (SELECT id FROM carts));

-- Reviews: public read; user own; seller reply; admin moderate
CREATE POLICY reviews_select ON reviews FOR SELECT USING (true);
CREATE POLICY reviews_insert_own ON reviews FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);

-- Shops: public read; owner manage
CREATE POLICY shops_select ON shops FOR SELECT USING (is_active = true);
CREATE POLICY shops_own ON shops FOR ALL
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Chat: participant only
CREATE POLICY chat_session_participant ON chat_sessions FOR ALL
  USING (buyer_id = current_setting('app.current_user_id', true)::uuid OR seller_id = current_setting('app.current_user_id', true)::uuid);
