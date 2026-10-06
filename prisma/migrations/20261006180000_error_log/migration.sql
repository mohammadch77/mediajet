-- لاگ خطاهای برنامه برای پنل ادمین (ادغام با fingerprint).
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "resolvedStack" TEXT,
    "componentStack" TEXT,
    "file" TEXT,
    "line" INTEGER,
    "column" INTEGER,
    "functionName" TEXT,
    "locationMapped" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "statusCode" INTEGER,
    "digest" TEXT,
    "userAgent" TEXT,
    "lastUserId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ErrorLog_fingerprint_key" ON "ErrorLog"("fingerprint");
CREATE INDEX "ErrorLog_status_lastSeenAt_idx" ON "ErrorLog"("status", "lastSeenAt");
CREATE INDEX "ErrorLog_lastSeenAt_idx" ON "ErrorLog"("lastSeenAt");
