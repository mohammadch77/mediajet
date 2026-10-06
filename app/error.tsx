"use client";
// مرز خطای صفحه‌ها: خطا بی‌صدا در لاگ ادمین ثبت می‌شود و کاربر فقط یک تجربه‌ی بازیابی نرم می‌بیند.

import { useEffect } from "react";
import SoftRecovery from "@/components/SoftRecovery";
import { isStaleChunkError, reloadOnceForNewVersion, reportClientError } from "@/lib/errorReporter";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isStaleChunkError(error.message, error.name) && reloadOnceForNewVersion()) return;
    reportClientError({
      kind: "boundary",
      message: `${error.name}: ${error.message}`,
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return <SoftRecovery onRetry={reset} />;
}
