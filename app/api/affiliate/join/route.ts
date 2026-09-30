import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { joinAffiliate } from "@/lib/affiliate";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

// POST /api/affiliate/join — ثبت‌نام رایگان کاربر جاری در برنامه‌ی همکاری (idempotent).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "برای ثبت‌نام در همکاری باید وارد حسابت شوی." }, { status: 401 });
  }

  const limit = checkRateLimit(`affiliate-join:${user.id}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  const code = await joinAffiliate(user.id);
  return NextResponse.json({ code });
}
