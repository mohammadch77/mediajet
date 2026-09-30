import { NextRequest, NextResponse } from "next/server";
import { validateInput, passwordLoginInput, ValidationError } from "@/lib/validation";
import { verifyEmailPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { authUserPayload } from "@/lib/authUser";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

// ضد brute-force: سقف روی هر IP و جداگانه روی هر ایمیل (حتی اگر مهاجم IP عوض کند).
// قفل شدن موقت ورود با ایمیل کاربر را بیرون نمی‌گذارد، چون ورود با OTP همیشه باز است.
const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;
const WINDOW_MS = 15 * 60_000;

const INVALID_CREDENTIALS = "ایمیل یا رمز عبور نادرست است.";

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

  const user = await verifyEmailPassword(input.email, input.password);
  if (!user) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  await createSession(user.id, getClientIp(req));
  return NextResponse.json({ user: await authUserPayload(user) });
}
