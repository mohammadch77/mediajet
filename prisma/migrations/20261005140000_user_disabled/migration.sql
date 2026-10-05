-- غیرفعال‌سازی کاربر توسط ادمین (ستون‌های اختیاری؛ روی داده‌ی موجود اثری ندارد).
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "disabledReason" TEXT;
