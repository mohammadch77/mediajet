import { NextResponse } from "next/server";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { ideAudit } from "@/lib/ide/audit";
import { buildProjectZip } from "@/lib/ide/zip";

// GET /api/admin/ide/zip — دانلود کل کد منبع (بدون node_modules/.next/.git/.env و کلیدها)
export async function GET() {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  try {
    const { buffer, fileCount } = await buildProjectZip();
    await ideAudit(guard.admin.id, "zip_download", undefined, `${fileCount} فایل، ${buffer.length} بایت`);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="getstock-code-${date}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return ideErrorResponse(error);
  }
}
