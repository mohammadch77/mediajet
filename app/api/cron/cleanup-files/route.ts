import { NextRequest, NextResponse } from "next/server";
import { cleanupStaleFiles } from "@/lib/fileCleanup";

// POST /api/cron/cleanup-files
// حذف فایل‌های کوچکِ روی دیسک که بیش از ۲۴ ساعت از آخرین دسترسی‌شان گذشته.
// باید به‌صورت دوره‌ای (مثلاً هر ساعت) توسط یک cron خارجی صدا زده شود؛ فقط با
// هدر Authorization: Bearer CRON_SECRET قابل‌اجراست.
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // در محیط توسعه بدون secret تنظیم‌شده، فقط برای تست محلی اجازه داده می‌شود.
    console.warn("[پاک‌سازی فایل] CRON_SECRET تنظیم نشده؛ endpoint بدون احراز هویت اجرا شد.");
  } else {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 401 });
    }
  }

  const result = await cleanupStaleFiles();
  return NextResponse.json({ ok: true, ...result });
}
