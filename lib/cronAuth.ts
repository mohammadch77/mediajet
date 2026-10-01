import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * احراز هویت endpointهای cron با هدر Authorization: Bearer CRON_SECRET.
 * اگر مجاز نبود پاسخ ۴۰۱/۵۰۳ برمی‌گرداند، وگرنه null.
 * در production بدون CRON_SECRET درخواست رد می‌شود (fail closed)؛ فقط در توسعه‌ی محلی بدون رمز اجازه می‌دهد.
 */
export function checkCronAuth(req: NextRequest, label: string): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      console.error(`[${label}] CRON_SECRET تنظیم نشده؛ درخواست cron رد شد.`);
      return NextResponse.json({ error: "cron پیکربندی نشده است." }, { status: 503 });
    }
    console.warn(`[${label}] CRON_SECRET تنظیم نشده؛ endpoint در محیط توسعه بدون احراز هویت اجرا شد.`);
    return null;
  }
  const received = Buffer.from(req.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${expected}`);
  if (received.length !== wanted.length || !crypto.timingSafeEqual(received, wanted)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 401 });
  }
  return null;
}
