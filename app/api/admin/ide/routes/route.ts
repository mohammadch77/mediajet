import { NextResponse } from "next/server";
import { ideGuard } from "@/lib/ide/guard";
import { listRoutes } from "@/lib/ide/files";

// ایستا نشود: وضعیت فلگ محیطی و session باید در هر درخواست خوانده شود، نه موقع build.
export const dynamic = "force-dynamic";

// GET /api/admin/ide/routes — نقشه‌ی صفحه‌ها و APIهای سایت با فایل کدشان
export async function GET() {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  return NextResponse.json({ routes: await listRoutes() });
}
