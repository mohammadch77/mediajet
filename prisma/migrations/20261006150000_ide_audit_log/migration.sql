-- ردّ حسابرسی ابزار توسعه‌ی پنل ادمین (فقط‌افزودنی).
CREATE TABLE "IdeAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "path" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdeAuditLog_createdAt_idx" ON "IdeAuditLog"("createdAt");
CREATE INDEX "IdeAuditLog_adminId_idx" ON "IdeAuditLog"("adminId");
