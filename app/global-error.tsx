"use client";
// آخرین خط دفاع: خطا در خودِ layout ریشه. جایگزین کل <html> می‌شود، پس استایل و رفتار را خودش دارد.
import "./globals.css";
import { useEffect } from "react";
import SoftRecovery from "@/components/SoftRecovery";
import { reportClientError } from "@/lib/errorReporter";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError({ kind: "boundary", message: `${error.name}: ${error.message}`, stack: error.stack, digest: error.digest });
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body>
        <SoftRecovery onRetry={reset} />
      </body>
    </html>
  );
}
