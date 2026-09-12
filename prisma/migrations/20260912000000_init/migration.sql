-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'awaiting_payment', 'queued', 'processing', 'ready', 'delivered', 'cancelled', 'failed', 'refunded');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceRial" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "ref" TEXT,
    "idempotencyKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceSite" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "priceRial" BIGINT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_idempotencyKey_key" ON "WalletTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_orderId_key" ON "Delivery"("orderId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =========================================================================
-- Hardening constraints beyond what Prisma's schema language can express.
-- These guarantee data integrity at the DATABASE level, independent of
-- application code correctness.
-- =========================================================================

-- موجودی کیف پول هرگز نباید منفی شود؛ حتی اگر باگی در سرویس، منطق کسر را
-- دور بزند، خود دیتابیس از ثبت مقدار نامعتبر جلوگیری می‌کند.
ALTER TABLE "Wallet"
    ADD CONSTRAINT "Wallet_balanceRial_nonnegative"
    CHECK ("balanceRial" >= 0);

-- amountRial همیشه باید مقداری مثبت باشد؛ جهتِ افزایش/کاهش موجودی صرفاً از
-- طریق ستون type ("credit"/"debit") تعیین می‌شود، نه علامتِ amountRial.
-- این یعنی منطق سرویس هرگز نباید عدد منفی در amountRial ذخیره کند.
ALTER TABLE "WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_amountRial_positive"
    CHECK ("amountRial" > 0);

-- balanceAfter هم نباید هرگز منفی شود (سازگار با محدودیت روی Wallet،
-- ولی مستقل ثبت می‌شود چون این ستون یک snapshot تاریخی و immutable است).
ALTER TABLE "WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_balanceAfter_nonnegative"
    CHECK ("balanceAfter" >= 0);

-- immutability: WalletTransaction فقط insert می‌شود؛ هیچ UPDATE یا DELETE
-- در سطح دیتابیس مجاز نیست (audit trail مالی نباید قابل تغییر باشد).
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is immutable: % is not allowed on this table', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WalletTransaction_no_update"
    BEFORE UPDATE ON "WalletTransaction"
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER "WalletTransaction_no_delete"
    BEFORE DELETE ON "WalletTransaction"
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- immutability: OrderEvent هم فقط insert می‌شود (تاریخچه‌ی تغییر وضعیت سفارش
-- نباید بعداً قابل ویرایش یا حذف باشد).
CREATE TRIGGER "OrderEvent_no_update"
    BEFORE UPDATE ON "OrderEvent"
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER "OrderEvent_no_delete"
    BEFORE DELETE ON "OrderEvent"
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
