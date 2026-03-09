-- CreateTable
CREATE TABLE "checkout_sessions" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT,
    "guest_email" TEXT,
    "guest_phone" TEXT,
    "guest_first_name" TEXT,
    "guest_last_name" TEXT,
    "cart_snapshot" JSONB NOT NULL,
    "shipping_address" JSONB NOT NULL,
    "delivery_type" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);
