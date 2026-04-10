-- POS / ombor: buyurtmada ombor yechimi vaqti — eski bazalarda ustun yoʻq.
-- Idempotent: squashed_init allaqachon ustunni qoʻshgan boʻlsa, hech narsa qilmaydi.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stock_deducted_at" TIMESTAMP(3);
