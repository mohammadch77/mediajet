import { NextResponse } from "next/server";
import { ideGuard } from "@/lib/ide/guard";
import { listRoutes } from "@/lib/ide/files";

// GET /api/admin/ide/routes — نقشه‌ی صفحه‌ها و APIهای سایت با فایل کدشان
export async function GET() {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  return NextResponse.json({ routes: await listRoutes() });
}
