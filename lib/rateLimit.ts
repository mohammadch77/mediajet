// محدودکننده‌ی نرخ درخواست برای مسیرهای حساس (شروع پرداخت، ثبت سفارش).
//
// پیاده‌سازی درون‌حافظه‌ای و per-process است: برای یک نمونه‌ی سرور کافی است ولی روی
// چند نمونه‌ی هم‌زمان مشترک نیست. اگر بعداً پشت چند instance رفتیم، همین اینترفیس را
// با Redis پیاده کنید؛ بقیه‌ی کد (routeها) دست‌نخورده می‌ماند.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** هر از چندگاهی کلیدهای منقضی پاک می‌شوند تا نقشه بی‌نهایت بزرگ نشود. */
function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** ثانیه‌های باقی‌مانده تا آزاد شدن محدودیت (وقتی allowed=false). */
  retryAfterSeconds: number;
};

/**
 * حداکثر `limit` درخواست در بازه‌ی `windowMs` برای یک کلید (معمولاً "مسیر:شناسه‌ی کاربر").
 * کلید همیشه باید از session ساخته شود، نه از ورودی کلاینت.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** پیام فارسی استاندارد برای پاسخ ۴۲۹. */
export function rateLimitMessage(retryAfterSeconds: number): string {
  return `تعداد درخواست‌ها بیش از حد مجاز است. لطفاً ${retryAfterSeconds} ثانیه‌ی دیگر دوباره تلاش کن.`;
}

/** فقط برای تست‌ها: پاک کردن وضعیت محدودیت. */
export function resetRateLimits(): void {
  buckets.clear();
}
