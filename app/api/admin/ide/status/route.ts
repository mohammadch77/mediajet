import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ideGuard, ideEnabled } from "@/lib/ide/guard";
import { IDE_UNLOCK_COOKIE, verifyUnlockToken } from "@/lib/ide/unlock";
import { IDE_ROOT } from "@/lib/ide/paths";

// ایستا نشود: وضعیت فلگ محیطی و session باید در هر درخواست خوانده شود، نه موقع build.
export const dynamic = "force-dynamic";

// GET /api/admin/ide/status — صفحه با این می‌فهمد ابزار روشن است، قفل است یا باز.
export async function GET() {
  if (!ideEnabled()) return NextResponse.json({ enabled: false, unlocked: false, hasPassword: false });
  const guard = await ideGuard({ requireUnlock: false });
  if (guard.response) return guard.response;

  return NextResponse.json({
    enabled: true,
    unlocked: verifyUnlockToken(cookies().get(IDE_UNLOCK_COOKIE)?.value, guard.admin.id),
    hasPassword: !!guard.admin.passwordHash,
    root: IDE_ROOT,
  });
}
