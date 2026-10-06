// گزارش بی‌صدای خطاهای مرورگر به /api/client-errors. فقط سمت کلاینت. هرگز چیزی به کاربر نشان نمی‌دهد،
// هرگز خطا پرتاب نمی‌کند و حجمش محدود است (سقف گزارش در هر بار بارگذاری + حذف تکراری).

export type ClientErrorKind = "error" | "unhandledrejection" | "boundary" | "api" | "network";

export type ClientErrorReport = {
  kind: ClientErrorKind;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  statusCode?: number;
  digest?: string | null;
};

const MAX_REPORTS_PER_PAGE = 8;
const sent = new Set<string>();

// fetch اصلی قبل از هرگونه wrapper نگه داشته می‌شود تا ارسال گزارش خودش گزارش تازه نسازد.
const nativeFetch: typeof fetch | null = typeof window !== "undefined" && window.fetch ? window.fetch.bind(window) : null;

/** استک‌های مربوط به افزونه‌های مرورگر یا اسکریپت‌های بیرونی، باگ سایت نیستند. */
export function isNoise(message: string, stack?: string | null): boolean {
  if (/ResizeObserver loop|Script error\.?$|Non-Error promise rejection|AbortError|The operation was aborted/i.test(message)) return true;
  if (stack && /(chrome|moz|safari)-extension:\/\//.test(stack)) return true;
  return false;
}

/** بعد از deploy، تب قدیمی فایل‌های جدید را نمی‌یابد؛ نیاز به بارگذاری مجدد است، نه گزارش باگ. */
export function isStaleChunkError(message: string, name?: string): boolean {
  return name === "ChunkLoadError" || /Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);
}

/** یک بار (در هر نشست مرورگر) صفحه را برای دریافت نسخه‌ی جدید دوباره بارگذاری می‌کند؛ true اگر بارگذاری شروع شد. */
export function reloadOnceForNewVersion(): boolean {
  try {
    const key = "gs-chunk-reload";
    const last = Number(sessionStorage.getItem(key) ?? "0");
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function reportClientError(report: ClientErrorReport): void {
  try {
    if (!nativeFetch || sent.size >= MAX_REPORTS_PER_PAGE) return;
    const message = String(report.message || "").slice(0, 1000);
    if (!message || isNoise(message, report.stack)) return;

    const firstFrame = (report.stack ?? "").split("\n").find((l) => /:\d+:\d+/.test(l)) ?? "";
    const dedupeKey = `${report.kind}|${message}|${firstFrame}`;
    if (sent.has(dedupeKey)) return;
    sent.add(dedupeKey);

    void nativeFetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        kind: report.kind,
        message,
        stack: report.stack ? report.stack.slice(0, 12000) : undefined,
        componentStack: report.componentStack ? report.componentStack.slice(0, 6000) : undefined,
        url: window.location.pathname,
        statusCode: report.statusCode,
        digest: report.digest ?? undefined,
      }),
    }).catch(() => undefined);
  } catch {
    /* گزارش‌دهی نباید چیزی بشکند */
  }
}
