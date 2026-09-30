-- ترتیب ثابت آیتم‌های سفارش. قبلاً ترتیب با createdAt تعیین می‌شد، ولی آیتم‌های یک سفارش چندآیتمی
-- با زمان یکسان ساخته می‌شوند و ترتیبشان نامعین بود («آیتم ۲» در تلگرام ممکن بود روی آیتم ۱ بنشیند).
ALTER TABLE "OrderItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- آیتم‌های موجود: همان ترتیبی که تا الان (به‌احتمال زیاد) نمایش داده می‌شد، با id برای شکستن تساوی.
UPDATE "OrderItem" oi
SET "position" = ranked.pos
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "orderId" ORDER BY "createdAt", id) - 1 AS pos
  FROM "OrderItem"
) ranked
WHERE oi.id = ranked.id;

CREATE UNIQUE INDEX "OrderItem_orderId_position_key" ON "OrderItem"("orderId", "position");
