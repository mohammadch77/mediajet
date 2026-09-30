import { NextRequest, NextResponse } from "next/server";
import { validateInput, requestPasswordResetInput, ValidationError } from "@/lib/validation";
import { requestPasswordReset, getResetMode } from "@/lib/passwordReset";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

// سقف per-mobile برای هر شماره (موجود یا ناموجود) یکسان اعمال می‌شود تا پاسخ ۴۲۹ هم
// وجود حساب را لو ندهد.
const IP_LIMIT = 5;
const MOBILE_LIMIT = 3;
const WINDOW_MS = 15 * 60_000;

// POST /api/auth/password-reset/request
// پاسخ همیشه یکسان است (چه شماره ثبت شده باشد چه نه). mode به کلاینت می‌گوید فرم کد را نشان دهد یا فقط منتظر لینک باشد.
export async function POST(req: NextRequest) {
  const ipLimit = checkRateLimit(`reset-request:ip:${getClientIp(req)}`, IP_LIMIT, WINDOW_MS);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(ipLimit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(requestPasswordResetInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const mobileLimit = checkRateLimit(`reset-request:mobile:${input.mobile}`, MOBILE_LIMIT, WINDOW_MS);
  if (!mobileLimit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(mobileLimit.retryAfterSeconds) }, { status: 429 });
  }

  await requestPasswordReset(input.mobile);

  return NextResponse.json({
    ok: true,
    mode: await getResetMode(),
    message: "اگر حسابی با این شماره وجود داشته باشد، پیامک بازیابی برایش ارسال شد.",
  });
}
