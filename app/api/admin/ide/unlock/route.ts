import { NextRequest, NextResponse } from "next/server";
import { ideGuard } from "@/lib/ide/guard";
import { ideAudit } from "@/lib/ide/audit";
import { createUnlockToken, IDE_UNLOCK_COOKIE, IDE_UNLOCK_TTL_MS } from "@/lib/ide/unlock";
import { verifyPasswordHash } from "@/lib/password";
import { validateInput, ValidationError, ideUnlockInput } from "@/lib/validation";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

// ایستا نشود: وضعیت فلگ محیطی و session باید در هر درخواست خوانده شود، نه موقع build.
export const dynamic = "force-dynamic";

// حدس رمز: حداکثر ۵ تلاش در ۱۰ دقیقه برای هر ادمین.
const UNLOCK_RATE_LIMIT = 5;
const UNLOCK_RATE_WINDOW_MS = 10 * 60_000;

// POST /api/admin/ide/unlock { password } — رمز ادمین را دوباره می‌گیرد و کوکی ۲۰ دقیقه‌ای می‌دهد.
export async function POST(req: NextRequest) {
  const guard = await ideGuard({ requireUnlock: false });
  if (guard.response) return guard.response;
  const admin = guard.admin;

  const limit = checkRateLimit(`ide-unlock:${admin.id}`, UNLOCK_RATE_LIMIT, UNLOCK_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(ideUnlockInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!admin.passwordHash) {
    return NextResponse.json(
      { error: "برای استفاده از ابزار توسعه ابتدا در پروفایل خودت ایمیل و رمز عبور تعریف کن." },
      { status: 403 },
    );
  }
  if (!(await verifyPasswordHash(input.password, admin.passwordHash))) {
    await ideAudit(admin.id, "unlock_failed");
    return NextResponse.json({ error: "رمز عبور نادرست است." }, { status: 401 });
  }

  await ideAudit(admin.id, "unlock");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(IDE_UNLOCK_COOKIE, createUnlockToken(admin.id), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: IDE_UNLOCK_TTL_MS / 1000,
    path: "/api/admin/ide",
  });
  return response;
}
