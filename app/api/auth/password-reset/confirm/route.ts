import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateInput,
  confirmResetByTokenInput,
  confirmResetByCodeInput,
  ValidationError,
} from "@/lib/validation";
import { resetPasswordWithToken, resetPasswordWithCode, PasswordResetError } from "@/lib/passwordReset";
import { createSession } from "@/lib/session";
import { authUserPayload } from "@/lib/authUser";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

const IP_LIMIT = 10;
const WINDOW_MS = 15 * 60_000;

// POST /api/auth/password-reset/confirm  body: { token, newPassword } | { mobile, code, newPassword }
// رمز جدید را تنظیم می‌کند، همه‌ی نشست‌های قبلی را باطل و یک نشست تازه می‌سازد (مالکیت موبایل ثابت شده).
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(`reset-confirm:ip:${getClientIp(req)}`, IP_LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let userId: string;
  try {
    const body = await req.json();
    if (body && typeof body === "object" && "token" in body) {
      const input = validateInput(confirmResetByTokenInput, body);
      userId = await resetPasswordWithToken(input.token, input.newPassword);
    } else {
      const input = validateInput(confirmResetByCodeInput, body);
      userId = await resetPasswordWithCode(input.mobile, input.code, input.newPassword);
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof PasswordResetError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
    }
    throw error;
  }

  await createSession(userId, getClientIp(req));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return NextResponse.json({ user: await authUserPayload(user) });
}
