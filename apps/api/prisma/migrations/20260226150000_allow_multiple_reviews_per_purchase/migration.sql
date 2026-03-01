-- DropIndex: allow multiple reviews per user per product (one per purchase)
DROP INDEX IF EXISTS "reviews_product_id_user_id_key";
