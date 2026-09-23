import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { validateInput, updateProfileNameInput, ValidationError } from "@/lib/validation";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const PROFILE_UPDATE_RATE_LIMIT = 10;
const PROFILE_UPDATE_RATE_WINDOW_MS = 60_000;

// PATCH /api/profile
// فقط نام کاربر جاری را به‌روزرسانی می‌کند؛ شماره‌ی موبایل و هویت همیشه از session خوانده می‌شود.
export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای ویرایش پروفایل باید وارد شوید." }, { status: 401 });
  }

  const limit = checkRateLimit(
    `profile-update:${currentUser.id}`,
    PROFILE_UPDATE_RATE_LIMIT,
    PROFILE_UPDATE_RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(updateProfileNameInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: currentUser.id },
    data: { name: input.name },
  });

  return NextResponse.json({ name: updated.name });
}
