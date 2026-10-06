-- دسته‌ی اشتباه آیتم سفارش: وضعیت rejected + ستون‌های ممیزی و مبلغ برگشتی.
ALTER TYPE "OrderItemStatus" ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE "OrderItem"
  ADD COLUMN "refundedRial" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "mismatchFrom" TEXT,
  ADD COLUMN "mismatchTo" TEXT,
  ADD COLUMN "mismatchById" TEXT,
  ADD COLUMN "mismatchAt" TIMESTAMP(3),
  ADD COLUMN "mismatchNote" TEXT;
