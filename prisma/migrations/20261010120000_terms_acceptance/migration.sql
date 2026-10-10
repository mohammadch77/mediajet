-- ثبت زمان و نسخه‌ی قوانینی که کاربر هنگام ثبت‌نام پذیرفته است.
ALTER TABLE "User"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT;
