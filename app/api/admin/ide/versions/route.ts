import { NextRequest, NextResponse } from "next/server";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { listVersions } from "@/lib/ide/files";

// GET /api/admin/ide/versions?path= — نسخه‌های پشتیبانِ یک فایل (جدید به قدیم)
export async function GET(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  try {
    return NextResponse.json({ versions: await listVersions(req.nextUrl.searchParams.get("path") ?? "") });
  } catch (error) {
    return ideErrorResponse(error);
  }
}
