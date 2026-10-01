-- step 15-20 (همکاری در فروش): این تغییرات در محیط cloud با db push اعمال شده بودند و migration نداشتند.
-- همه‌ی تغییرات افزایشی‌اند (جدول جدید + ستون nullable)؛ هیچ داده‌ای حذف یا تغییر نمی‌کند.

-- CreateEnum
CREATE TYPE "AffiliateEntryType" AS ENUM ('commission', 'payout_hold', 'payout_release', 'commission_reversal', 'adjustment_credit', 'adjustment_debit');

-- CreateEnum
CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('requested', 'paid', 'rejected');

-- CreateEnum
CREATE TYPE "PendingCommissionStatus" AS ENUM ('pending', 'released', 'cancelled');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "affiliateJoinedAt" TIMESTAMP(3),
ADD COLUMN     "affiliateSuspendReason" TEXT,
ADD COLUMN     "affiliateSuspendedAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginIp" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT,
ADD COLUMN     "signupIp" TEXT;

-- CreateTable
CREATE TABLE "AffiliateAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceRial" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "AffiliateAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateLedger" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "AffiliateEntryType" NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "orderId" TEXT,
    "payoutId" TEXT,
    "sourceUserId" TEXT,
    "baseRial" BIGINT,
    "percent" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateAdminLog" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateAdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "cardHolder" TEXT NOT NULL,
    "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'requested',
    "adminNote" TEXT,
    "bankRef" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePendingCommission" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "baseRial" BIGINT NOT NULL,
    "percent" INTEGER NOT NULL,
    "amountRial" BIGINT NOT NULL,
    "status" "PendingCommissionStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AffiliatePendingCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateFraudFlag" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,

    CONSTRAINT "AffiliateFraudFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateAccount_userId_key" ON "AffiliateAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLedger_idempotencyKey_key" ON "AffiliateLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AffiliateLedger_accountId_idx" ON "AffiliateLedger"("accountId");

-- CreateIndex
CREATE INDEX "AffiliateAdminLog_targetUserId_idx" ON "AffiliateAdminLog"("targetUserId");

-- CreateIndex
CREATE INDEX "AffiliatePayout_userId_idx" ON "AffiliatePayout"("userId");

-- CreateIndex
CREATE INDEX "AffiliatePayout_status_idx" ON "AffiliatePayout"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliatePendingCommission_orderId_key" ON "AffiliatePendingCommission"("orderId");

-- CreateIndex
CREATE INDEX "AffiliatePendingCommission_affiliateId_status_idx" ON "AffiliatePendingCommission"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliatePendingCommission_status_createdAt_idx" ON "AffiliatePendingCommission"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateFraudFlag_dedupeKey_key" ON "AffiliateFraudFlag"("dedupeKey");

-- CreateIndex
CREATE INDEX "AffiliateFraudFlag_affiliateId_resolvedAt_idx" ON "AffiliateFraudFlag"("affiliateId", "resolvedAt");

-- CreateIndex
CREATE INDEX "AffiliateFraudFlag_resolvedAt_idx" ON "AffiliateFraudFlag"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateAccount" ADD CONSTRAINT "AffiliateAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLedger" ADD CONSTRAINT "AffiliateLedger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AffiliateAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateAdminLog" ADD CONSTRAINT "AffiliateAdminLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateAdminLog" ADD CONSTRAINT "AffiliateAdminLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayout" ADD CONSTRAINT "AffiliatePayout_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePendingCommission" ADD CONSTRAINT "AffiliatePendingCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateFraudFlag" ADD CONSTRAINT "AffiliateFraudFlag_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateFraudFlag" ADD CONSTRAINT "AffiliateFraudFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- دفتر کمیسیون و لاگ اقدامات ادمین append-only هستند (مثل WalletTransaction و OrderEvent):
-- UPDATE/DELETE در سطح دیتابیس ممنوع است. تابع forbid_mutation در migration اولیه تعریف شده.
CREATE TRIGGER "AffiliateLedger_no_update"
    BEFORE UPDATE ON "AffiliateLedger"
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER "AffiliateLedger_no_delete"
    BEFORE DELETE ON "AffiliateLedger"
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER "AffiliateAdminLog_no_update"
    BEFORE UPDATE ON "AffiliateAdminLog"
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER "AffiliateAdminLog_no_delete"
    BEFORE DELETE ON "AffiliateAdminLog"
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- مبلغ هر ردیف دفتر همیشه مثبت است (جهت با type مشخص می‌شود). balanceAfter عمداً می‌تواند منفی شود:
-- برگشت کمیسیونِ قبلاً تسویه‌شده بدهی همکار را ثبت می‌کند (lib/affiliate.ts).
ALTER TABLE "AffiliateLedger"
    ADD CONSTRAINT "AffiliateLedger_amountRial_positive" CHECK ("amountRial" > 0);