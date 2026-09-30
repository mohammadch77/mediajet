import type { NextRequest } from "next/server";

/**
 * IP کلاینت برای کلید rate limit. هدر X-Forwarded-For را هر کلاینتی می‌تواند جعل کند، پس فقط
 * وقتی TRUST_PROXY=true است (سرور پشت nginx/پروکسی خودمان که هدر را بازنویسی می‌کند) خوانده می‌شود.
 * بدون آن، همه‌ی درخواست‌های بی‌IP یک سطل مشترک دارند؛ محدودیت per-email/per-mobile جداگانه هم برقرار است.
 */
export function getClientIp(req: NextRequest): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
    const realIp = req.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
  }
  return req.ip ?? "unknown";
}
