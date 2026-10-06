// اجرا یک‌بار موقع بالا آمدن سرور Next (فقط runtime نود): نصب هوک ثبت خطاهای سمت سرور در لاگ ادمین.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { installServerErrorHook } = await import("./lib/serverErrorHook");
  installServerErrorHook();
}
