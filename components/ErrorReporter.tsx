"use client";
// نصب شنونده‌های سراسری خطا در مرورگر. چیزی رندر نمی‌کند و هیچ تغییری در تجربه‌ی کاربر نمی‌دهد؛
// فقط خطاهای واقعی کد (error / unhandledrejection / پاسخ ۵xx از API خودمان) را بی‌صدا گزارش می‌کند.

import { useEffect } from "react";
import { isStaleChunkError, reloadOnceForNewVersion, reportClientError } from "@/lib/errorReporter";

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const error = event.error as (Error & { name?: string }) | undefined;
      const message = error?.message ?? event.message ?? "";
      if (isStaleChunkError(message, error?.name)) {
        reloadOnceForNewVersion();
        return;
      }
      reportClientError({ kind: "error", message: `${error?.name ?? "Error"}: ${message}`, stack: error?.stack ?? `at ${event.filename}:${event.lineno}:${event.colno}` });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as (Error & { name?: string }) | string | undefined;
      const message = typeof reason === "string" ? reason : reason?.message ?? "";
      if (isStaleChunkError(message, typeof reason === "object" ? reason?.name : undefined)) {
        reloadOnceForNewVersion();
        return;
      }
      // قطع‌شدن اینترنت/فیلترینگ کاربر باگ نیست؛ خطای شبکه‌ی fetch گزارش نمی‌شود.
      if (/Failed to fetch|Load failed|NetworkError|Network request failed/i.test(message)) return;
      reportClientError({
        kind: "unhandledrejection",
        message: typeof reason === "string" ? reason : `${reason?.name ?? "Error"}: ${message}`,
        stack: typeof reason === "object" ? reason?.stack : undefined,
      });
    };

    // پاسخ ۵xx از APIهای خودمان یعنی خطای سرور؛ گزارش می‌شود ولی پاسخ دست‌نخورده به کد صفحه می‌رسد.
    const originalFetch = window.fetch;
    const patchedFetch: typeof window.fetch = async (...args) => {
      const response = await originalFetch.apply(window, args);
      try {
        if (response.status >= 500) {
          const input = args[0];
          const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          const url = new URL(rawUrl, window.location.origin);
          if (url.origin === window.location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/client-errors")) {
            const method = (args[1]?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
            reportClientError({ kind: "api", message: `API ${response.status} ${method} ${url.pathname}`, statusCode: response.status });
          }
        }
      } catch {
        /* گزارش‌دهی نباید پاسخ را خراب کند */
      }
      return response;
    };
    window.fetch = patchedFetch;

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      if (window.fetch === patchedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
