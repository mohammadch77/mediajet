import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { validateInput, setCredentialsInput, ValidationError } from "@/lib/validation";
import { getCurrentUser, revokeOtherSessions } from "@/lib/session";
import { hashPassword, verifyPasswordHash } from "@/lib/password";
import { authUserPayload } from "@/lib/authUser";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const UNIQUE_VIOLATION = "P2002";
const USER_LIMIT = 10;
const WINDOW_MS = 15 * 60_000;

// POST /api/auth/credentials
// تنظیم یا تغییر ایمیل و رمز عبور کاربر واردشده.
// - کاربر بدون رمز (ثبت‌نام جدید یا کاربر قدیمی که فقط OTP داشت): فقط با نشست معتبر تنظیم می‌شود.
// - کاربر دارای رمز: تغییر فقط با رمز فعلی؛ سپس بقیه‌ی نشست‌هایش باطل می‌شوند.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "برای این عملیات باید وارد شوید." }, { status: 401 });
  }

  const limit = checkRateLimit(`credentials:${user.id}`, USER_LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(setCredentialsInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const hadPassword = user.passwordHash !== null;
  if (hadPassword) {
    if (!input.currentPassword || !(await verifyPasswordHash(input.currentPassword, user.passwordHash!))) {
      return NextResponse.json({ error: "رمز عبور فعلی نادرست است." }, { status: 403 });
    }
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.newPassword),
        passwordUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ error: "این ایمیل قبلاً برای حساب دیگری ثبت شده است." }, { status: 409 });
    }
    throw error;
  }

  if (hadPassword) {
    await revokeOtherSessions(user.id);
  }

  return NextResponse.json({ user: await authUserPayload(updated) });
}
