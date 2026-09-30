import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { authUserPayload } from "@/lib/authUser";

// GET /api/auth/me
// کاربر جاری را از روی نشست برمی‌گرداند؛ اگر واردنشده باشد user: null.
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? await authUserPayload(user) : null });
}
