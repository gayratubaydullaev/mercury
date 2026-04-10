-- Platform sozlamalari: chat sotuvchi bilan — eski bazalarda ustun yoʻq (GET /products/:id xatosi).
-- Idempotent: squashed_init allaqachon qoʻshgan boʻlsa, hech narsa qilmaydi.

ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "chat_with_seller_enabled" BOOLEAN NOT NULL DEFAULT true;
