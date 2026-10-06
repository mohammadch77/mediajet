import { NextResponse } from "next/server";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { getGithubConfig } from "@/lib/ide/github";
import { getSyncStatus } from "@/lib/ide/sync";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/admin/ide/sync/status — مقایسه‌ی سرور با گیت‌هاب (بدون هیچ تغییری)
export async function GET() {
  const guard = await ideGuard();
  if (guard.response) return guard.response;

  const limit = checkRateLimit(`ide-sync-status:${guard.admin.id}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });

  try {
    return NextResponse.json(await getSyncStatus(await getGithubConfig()));
  } catch (error) {
    return ideErrorResponse(error);
  }
}
