import { NextRequest, NextResponse } from "next/server";
import { cleanupStaleFiles } from "@/lib/fileCleanup";
import { checkCronAuth } from "@/lib/cronAuth";

// POST /api/cron/cleanup-files
// حذف فایل‌های کوچکِ روی دیسک که بیش از ۲۴ ساعت از آخرین دسترسی‌شان گذشته.
// باید به‌صورت دوره‌ای (مثلاً هر ساعت) توسط یک cron خارجی صدا زده شود؛ فقط با
// هدر Authorization: Bearer CRON_SECRET قابل‌اجراست.
export async function POST(req: NextRequest) {
  const denied = checkCronAuth(req, "پاک‌سازی فایل");
  if (denied) return denied;

  const result = await cleanupStaleFiles();
  return NextResponse.json({ ok: true, ...result });
}
