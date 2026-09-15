-- سفارش چندآیتمی + سبد خرید.
-- این migration داده‌ی موجود را حفظ می‌کند: هر سفارش قبلی دقیقاً یک OrderItem می‌گیرد
-- (با همان category/sourceSite/productUrl/priceRial قبلی‌اش) و هر Delivery موجود به
-- همان OrderItem تازه‌ساخته‌شده وصل می‌شود.

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'ready', 'delivered');

-- CreateTable OrderItem
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sourceSite" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "priceRial" BIGINT NOT NULL,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- Add new Order columns (nullable first so we can backfill)
ALTER TABLE "Order" ADD COLUMN "totalPriceRial" BIGINT;
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT;

-- Backfill Order.totalPriceRial from the old single-item priceRial (no surcharge info existed
-- separately before this migration, so totalPriceRial = what the user actually paid).
UPDATE "Order" SET "totalPriceRial" = "priceRial";
-- Old orders had no stored payment method; default to "wallet" (the original-only method)
-- as a safe placeholder — it does not affect already-settled orders' history/audit trail.
UPDATE "Order" SET "paymentMethod" = 'wallet';

ALTER TABLE "Order" ALTER COLUMN "totalPriceRial" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET NOT NULL;

-- Data migration: one OrderItem per existing Order, carrying over its item-level fields
-- and a status derived from the order's own status (so already-delivered orders keep
-- their items marked delivered, ready orders keep items ready, everything else pending).
INSERT INTO "OrderItem" ("id", "orderId", "sourceSite", "category", "productUrl", "priceRial", "status", "createdAt", "updatedAt")
SELECT
    substr(md5(o."id" || '-item-' || clock_timestamp()::text || random()::text), 1, 25),
    o."id",
    o."sourceSite",
    o."category",
    o."productUrl",
    o."priceRial",
    CASE
        WHEN o."status" = 'delivered' THEN 'delivered'::"OrderItemStatus"
        WHEN o."status" = 'ready' THEN 'ready'::"OrderItemStatus"
        ELSE 'pending'::"OrderItemStatus"
    END,
    o."createdAt",
    o."updatedAt"
FROM "Order" o;

-- Drop old single-item columns from Order
ALTER TABLE "Order" DROP COLUMN "sourceSite";
ALTER TABLE "Order" DROP COLUMN "category";
ALTER TABLE "Order" DROP COLUMN "productUrl";
ALTER TABLE "Order" DROP COLUMN "priceRial";

-- AddForeignKey + index for OrderItem
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Re-point Delivery from Order to OrderItem (1 old order == 1 new item, so the mapping is exact)
ALTER TABLE "Delivery" ADD COLUMN "orderItemId" TEXT;

UPDATE "Delivery" d
SET "orderItemId" = oi."id"
FROM "OrderItem" oi
WHERE oi."orderId" = d."orderId";

ALTER TABLE "Delivery" DROP CONSTRAINT "Delivery_orderId_fkey";
ALTER TABLE "Delivery" DROP COLUMN "orderId";
ALTER TABLE "Delivery" ALTER COLUMN "orderItemId" SET NOT NULL;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderItemId_key" UNIQUE ("orderItemId");
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable Cart
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable CartItem
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "sourceSite" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "priceRial" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
