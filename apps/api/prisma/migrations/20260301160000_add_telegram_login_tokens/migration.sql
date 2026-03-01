-- CreateTable
CREATE TABLE "telegram_login_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "telegram_chat_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_login_tokens_token_key" ON "telegram_login_tokens"("token");
