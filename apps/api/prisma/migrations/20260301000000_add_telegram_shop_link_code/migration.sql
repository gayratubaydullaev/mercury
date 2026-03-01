-- AlterTable
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT;
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "telegram_type" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "telegram_link_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_link_codes_code_key" ON "telegram_link_codes"("code");
