import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { joinAffiliate } from "@/lib/affiliate";
import { validateInput, affiliateJoinInput, ValidationError } from "@/lib/validation";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

// POST /api/affiliate/join — ثبت‌نام رایگان کاربر جاری در برنامه‌ی همکاری (idempotent).
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "برای ثبت‌نام در همکاری باید وارد حسابت شوی." }, { status: 401 });
  }

  const limit = checkRateLimit(`affiliate-join:${user.id}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  try {
    validateInput(affiliateJoinInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const code = await joinAffiliate(user.id);
  return NextResponse.json({ code });
}
