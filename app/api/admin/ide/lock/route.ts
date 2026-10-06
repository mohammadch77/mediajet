import { NextResponse } from "next/server";
import { ideGuard } from "@/lib/ide/guard";
import { IDE_UNLOCK_COOKIE } from "@/lib/ide/unlock";

// ایستا نشود: وضعیت فلگ محیطی و session باید در هر درخواست خوانده شود، نه موقع build.
export const dynamic = "force-dynamic";

// POST /api/admin/ide/lock — قفل را همان لحظه می‌بندد.
export async function POST() {
  const guard = await ideGuard({ requireUnlock: false });
  if (guard.response) return guard.response;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(IDE_UNLOCK_COOKIE, "", { maxAge: 0, path: "/api/admin/ide" });
  return response;
}
