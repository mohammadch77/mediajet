// آدرس پایه‌ی سایت برای canonical، داده‌ی ساختاریافته (JSON-LD) و نقشه‌ی سایت. فقط سمت سرور استفاده شود.
export const SITE_URL = (process.env.APP_BASE_URL || "https://getstock.ir").replace(/\/+$/, "");

/** مسیر داخلی (مثل /blog/a.png) را به آدرس کامل تبدیل می‌کند؛ آدرس کامل را دست‌نخورده برمی‌گرداند. */
export function absoluteUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}
