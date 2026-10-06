import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/admin/errors/summary — تعداد خطاهای باز (برای نشان کنار منوی ادمین)
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  return NextResponse.json({ open: await prisma.errorLog.count({ where: { status: "open" } }) });
}
