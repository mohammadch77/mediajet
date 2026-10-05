import { NextRequest, NextResponse } from "next/server";
import { validateInput, passwordLoginInput, ValidationError } from "@/lib/validation";
import { verifyEmailPassword } from "@/lib/password";
import { createSession, DISABLED_ACCOUNT_MESSAGE } from "@/lib/session";
import { authUserPayload } from "@/lib/authUser";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

// ضد brute-force: سقف روی هر IP و جداگانه روی هر ایمیل (حتی اگر مهاجم IP عوض کند).
// قفل شدن موقت ورود با ایمیل کاربر را بیرون نمی‌گذارد، چون ورود با OTP همیشه باز است.
const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;
const WINDOW_MS = 15 * 60_000;

const LOGIN_ERRORS = {
  not_found: { message: "کاربری با این ایمیل ثبت‌نام نکرده است.", status: 404 },
  no_password: { message: "برای این حساب رمز عبور تنظیم نشده است؛ با کد پیامکی وارد شوید.", status: 401 },
  wrong_password: { message: "رمز عبور نادرست است.", status: 401 },
  disabled: { message: DISABLED_ACCOUNT_MESSAGE, status: 403 },
} as const;

// POST /api/auth/login
// ورود با ایمیل و رمز عبور، بدون پیامک.
export async function POST(req: NextRequest) {
  const ipLimit = checkRateLimit(`login:ip:${getClientIp(req)}`, IP_LIMIT, WINDOW_MS);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(ipLimit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(passwordLoginInput, await req.json());
  } catch (error) {
    // ایمیل با فرمت نادرست همان پیام عمومی را می‌گیرد؛ جزئیات اعتبارسنجی لازم نیست.
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const emailLimit = checkRateLimit(`login:email:${input.email}`, EMAIL_LIMIT, WINDOW_MS);
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: `${rateLimitMessage(emailLimit.retryAfterSeconds)} می‌توانی با کد پیامکی وارد شوی.` },
      { status: 429 },
    );
  }

  const result = await verifyEmailPassword(input.email, input.password);
  if (!result.ok) {
    const { message, status } = LOGIN_ERRORS[result.reason];
    return NextResponse.json({ error: message }, { status });
  }

  await createSession(result.user.id, getClientIp(req));
  return NextResponse.json({ user: await authUserPayload(result.user) });
}
