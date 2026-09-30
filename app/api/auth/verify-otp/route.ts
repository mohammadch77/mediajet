import { NextRequest, NextResponse } from "next/server";
import { validateInput, verifyOtpInput, ValidationError } from "@/lib/validation";
import { verifyOtp, OtpError } from "@/lib/otp";
import { findOrCreateUserByMobile, createSession } from "@/lib/session";
import { authUserPayload } from "@/lib/authUser";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

const IP_LIMIT = 20;
const WINDOW_MS = 15 * 60_000;

// POST /api/auth/verify-otp
// تأیید کد OTP؛ در صورت موفقیت کاربر را (در صورت نبود) می‌سازد و نشست ورود ایجاد می‌کند.
// needsCredentials=true یعنی کاربر هنوز ایمیل/رمز ندارد و باید از او خواسته شود (ثبت‌نام جدید یا کاربر قدیمی).
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`verify-otp:ip:${getClientIp(req)}`, IP_LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(verifyOtpInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await verifyOtp(input.mobile, input.code);
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }

  const user = await findOrCreateUserByMobile(input.mobile, getClientIp(req));
  await createSession(user.id, getClientIp(req));

  const payload = await authUserPayload(user);
  return NextResponse.json({ user: payload, needsCredentials: !payload.hasPassword });
}
