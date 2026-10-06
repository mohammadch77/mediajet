// اجرا یک‌بار موقع بالا آمدن سرور Next: نصب هوک ثبت خطاهای سمت سرور در لاگ ادمین.
// شرط باید دقیقاً به‌شکل `=== "nodejs"` دور import باشد تا webpack این کد را از بسته‌ی edge حذف کند
// (در غیر این صورت fs/path در edge پیدا نمی‌شوند و build می‌شکند).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { installServerErrorHook } = await import("./lib/serverErrorHook");
      installServerErrorHook();
    }
  }
}
