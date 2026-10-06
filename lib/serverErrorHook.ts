// ثبت خطاهای سمت سرور در ErrorLog، بدون نیاز به دست‌زدن به تک‌تک routeها:
//  - unhandledRejection و uncaughtExceptionMonitor (بدون تغییر رفتار پیش‌فرض نود)
//  - console.error: Next خطای پرتاب‌شده‌ی routeها/صفحه‌ها را با console.error چاپ می‌کند و کد خودمان هم
//    خطاهای گرفته‌شده را همین‌طور؛ هر Error داخل آرگومان‌ها ثبت می‌شود.
// خطاهای انتظاری Next (redirect/notFound/dynamic) و خطاهای خودِ لاگ‌گیری نادیده گرفته می‌شوند.

import { recordError } from "./errorLog";

let installed = false;
let capturing = false;

function isIgnorable(error: Error & { digest?: string }): boolean {
  const text = `${error.message} ${error.digest ?? ""}`;
  return /NEXT_REDIRECT|NEXT_NOT_FOUND|DYNAMIC_SERVER_USAGE|Dynamic server usage|ErrorLog|errorLog/.test(text);
}

function capture(error: unknown, kind: "server"): void {
  if (capturing) return;
  if (!(error instanceof Error)) return;
  const err = error as Error & { digest?: string };
  if (isIgnorable(err)) return;
  capturing = true;
  void recordError({
    source: "server",
    kind,
    message: `${err.name}: ${err.message}`,
    stack: err.stack ?? null,
    digest: err.digest ?? null,
  }).finally(() => {
    capturing = false;
  });
}

export function installServerErrorHook(): void {
  if (installed) return;
  installed = true;

  // استک خطاها با source map به کد اصلی (مثلاً app/api/x/route.ts:23) نگاشته شود.
  try {
    (process as unknown as { setSourceMapsEnabled?: (v: boolean) => void }).setSourceMapsEnabled?.(true);
  } catch {
    /* نسخه‌ی قدیمی نود */
  }

  process.on("unhandledRejection", (reason) => capture(reason, "server"));
  process.on("uncaughtExceptionMonitor", (error) => capture(error, "server"));

  const original = console.error;
  console.error = (...args: unknown[]) => {
    original.apply(console, args as []);
    try {
      for (const arg of args) if (arg instanceof Error) capture(arg, "server");
    } catch {
      /* لاگ‌گیری نباید چیزی بشکند */
    }
  };
}
