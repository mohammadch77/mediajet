-- شماره‌ی کوتاه سفارش: از ۱۰۰۱ شروع می‌شود؛ سفارش‌های موجود به ترتیب زمان ثبت شماره می‌گیرند.
CREATE SEQUENCE "Order_orderNumber_seq" START WITH 1001;

ALTER TABLE "Order" ADD COLUMN "orderNumber" INTEGER;

UPDATE "Order" o
SET "orderNumber" = numbered.n
FROM (
  SELECT id, nextval('"Order_orderNumber_seq"') AS n
  FROM (SELECT id FROM "Order" ORDER BY "createdAt", id) ordered
) numbered
WHERE o.id = numbered.id;

ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET DEFAULT nextval('"Order_orderNumber_seq"');
ALTER SEQUENCE "Order_orderNumber_seq" OWNED BY "Order"."orderNumber";

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
