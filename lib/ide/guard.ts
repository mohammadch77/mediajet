// دروازه‌ی مشترک همه‌ی endpointهای /api/admin/ide: سه لایه + سقف نرخ.
//   ۱) فلگ محیطی ADMIN_IDE_ENABLED=true (روی سرور، نه از پنل: دیتابیس لو برود مهاجم نمی‌تواند روشنش کند)
//   ۲) نقش admin از session
//   ۳) کوکی بازکردن قفل (رمز مجدد)؛ فقط برای endpoint خودِ unlock/status لازم نیست

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { requireAdmin, SessionError } from "@/lib/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { IDE_UNLOCK_COOKIE, verifyUnlockToken } from "./unlock";
import { IdeError } from "./paths";

const IDE_RATE_LIMIT = 240;
const IDE_RATE_WINDOW_MS = 60_000;

export function ideEnabled(): boolean {
  return process.env.ADMIN_IDE_ENABLED === "true";
}

type Guard = { admin: User; response?: undefined } | { admin?: undefined; response: NextResponse };

export async function ideGuard(options: { requireUnlock: boolean } = { requireUnlock: true }): Promise<Guard> {
  if (!ideEnabled()) {
    return {
      response: NextResponse.json(
        { error: "ابزار توسعه روی این سرور فعال نیست. در .env مقدار ADMIN_IDE_ENABLED=true را بگذار و برنامه را ری‌استارت کن." },
        { status: 403 },
      ),
    };
  }

  let admin: User;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return { response: NextResponse.json({ error: error.message }, { status: 403 }) };
    }
    throw error;
  }

  const limit = checkRateLimit(`ide:${admin.id}`, IDE_RATE_LIMIT, IDE_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return { response: NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 }) };
  }

  if (options.requireUnlock && !verifyUnlockToken(cookies().get(IDE_UNLOCK_COOKIE)?.value, admin.id)) {
    return {
      response: NextResponse.json(
        { error: "برای ادامه، رمز عبور را دوباره وارد کن.", locked: true },
        { status: 401 },
      ),
    };
  }
  return { admin };
}

/** تبدیل خطای دامنه به پاسخ JSON؛ خطای ناشناخته دوباره پرتاب می‌شود. */
export function ideErrorResponse(error: unknown): NextResponse {
  if (error instanceof IdeError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
