import { NextRequest, NextResponse } from "next/server";
import { releaseDueCommissions } from "@/lib/affiliate";
import { checkCronAuth } from "@/lib/cronAuth";

// POST /api/cron/affiliate
// آزادسازی خودکار کمیسیون‌های در انتظار: سفارش‌های تحویل‌شده، و سفارش‌های «آماده»ای که دوره‌ی
// انتظار (تنظیمات ادمین) از پرداختشان گذشته. باید دوره‌ای (مثلاً هر ساعت) صدا زده شود؛
// فقط با هدر Authorization: Bearer CRON_SECRET.
export async function POST(req: NextRequest) {
  const denied = checkCronAuth(req, "آزادسازی کمیسیون");
  if (denied) return denied;

  const result = await releaseDueCommissions();
  return NextResponse.json({ ok: true, ...result });
}
