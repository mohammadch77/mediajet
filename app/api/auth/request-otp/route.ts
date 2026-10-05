import { NextRequest, NextResponse } from "next/server";
import { validateInput, requestOtpInput, ValidationError } from "@/lib/validation";
import { requestOtp, OtpError } from "@/lib/otp";
import { SmsError } from "@/lib/sms";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

// هر پیامک هزینه دارد: علاوه بر فاصله‌ی ۶۰ ثانیه‌ای هر شماره (lib/otp.ts)، هر IP سقف دارد.
const IP_LIMIT = 10;
const WINDOW_MS = 15 * 60_000;

// POST /api/auth/request-otp
// ارسال کد تأیید برای موبایل داده‌شده (در حالت شبیه‌سازی، کد در کنسول سرور چاپ می‌شود).
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`request-otp:ip:${getClientIp(req)}`, IP_LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(requestOtpInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await requestOtp(input.mobile);
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof SmsError) {
      // خطای سرویس‌دهنده‌ی پیامک، نه محدودیت نرخ: ۵۰۲ با پیام فارسی تا UI آن را نشان دهد.
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
