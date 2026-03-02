-- AlterTable
ALTER TABLE "Order" ADD COLUMN "guest_view_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_guest_view_token_key" ON "Order"("guest_view_token");
