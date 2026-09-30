import { NextResponse, type NextRequest } from "next/server";

/**
 * احراز هویت endpointهای cron با هدر Authorization: Bearer CRON_SECRET.
 * اگر مجاز نبود پاسخ ۴۰۱ برمی‌گرداند، وگرنه null. در توسعه‌ی محلی بدون CRON_SECRET اجازه می‌دهد (با هشدار).
 */
export function checkCronAuth(req: NextRequest, label: string): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn(`[${label}] CRON_SECRET تنظیم نشده؛ endpoint بدون احراز هویت اجرا شد.`);
    return null;
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 401 });
  }
  return null;
}
