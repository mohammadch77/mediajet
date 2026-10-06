import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { getPaymentResult } from "@/lib/paymentResult";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const RESULT_RATE_LIMIT = 30;
const RESULT_RATE_WINDOW_MS = 60_000;

const querySchema = z.object({ authority: z.string().min(1).max(100) });

// GET /api/payments/result?authority=...
// نتیجه‌ی پرداخت خود کاربر برای صفحه‌ی /pay/result؛ پرداخت دیگران هرگز برگردانده نمی‌شود.
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای دیدن نتیجه‌ی پرداخت باید وارد شوید." }, { status: 401 });
  }

  const limit = checkRateLimit(`payment-result:${currentUser.id}`, RESULT_RATE_LIMIT, RESULT_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  const parsed = querySchema.safeParse({ authority: req.nextUrl.searchParams.get("authority") });
  if (!parsed.success) {
    return NextResponse.json({ error: "شناسه‌ی پرداخت نامعتبر است." }, { status: 400 });
  }

  const result = await getPaymentResult(currentUser.id, parsed.data.authority);
  if (!result) {
    return NextResponse.json({ error: "پرداخت یافت نشد." }, { status: 404 });
  }
  return NextResponse.json(result);
}
