-- Kassir (CASHIER): `users.staff_shop_id` — eski bazalarda ustun yoʻq boʻlishi mumkin.
-- Idempotent: squashed_init allaqachon ustunni yaratgan boʻlsa, bu migratsiya hech narsa qilmaydi.
-- Tartib: squashed_init dan keyin (boʻsh bazada avval jadval yaratiladi).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "staff_shop_id" TEXT;

CREATE INDEX IF NOT EXISTS "users_staff_shop_id_idx" ON "users"("staff_shop_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_staff_shop_id_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_staff_shop_id_fkey"
      FOREIGN KEY ("staff_shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
