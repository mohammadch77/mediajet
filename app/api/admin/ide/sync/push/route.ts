import { NextRequest, NextResponse } from "next/server";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { ideAudit } from "@/lib/ide/audit";
import { getGithubConfig } from "@/lib/ide/github";
import { pushChanges } from "@/lib/ide/sync";
import { validateInput, ValidationError, ideSyncPushInput } from "@/lib/validation";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// POST /api/admin/ide/sync/push { message, paths? } — ارسال تغییرات سرور به گیت‌هاب در یک کامیت
export async function POST(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;

  const limit = checkRateLimit(`ide-sync-push:${guard.admin.id}`, 10, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });

  let input;
  try {
    input = validateInput(ideSyncPushInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await pushChanges(await getGithubConfig(), input.message, input.paths);
    await ideAudit(guard.admin.id, "sync_push", undefined, `commit=${result.commit} files=${result.count}`);
    return NextResponse.json(result);
  } catch (error) {
    return ideErrorResponse(error);
  }
}
