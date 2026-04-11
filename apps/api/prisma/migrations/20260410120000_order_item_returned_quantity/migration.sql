-- AlterTable
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "returned_quantity" INTEGER NOT NULL DEFAULT 0;
