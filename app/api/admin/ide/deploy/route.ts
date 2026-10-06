import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { ideAudit } from "@/lib/ide/audit";
import { getDeployStatus, latestDeployId, startDeploy } from "@/lib/ide/deploy";
import { validateInput, ValidationError } from "@/lib/validation";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

// deploy مسیر پرخطر است: حداکثر ۵ بار در ۱۰ دقیقه برای هر ادمین.
const DEPLOY_RATE_LIMIT = 5;
const DEPLOY_RATE_WINDOW_MS = 10 * 60_000;

const deployInput = z.object({
  install: z.boolean({ error: "گزینه‌ی نصب وابستگی نامعتبر است." }),
  migrate: z.boolean({ error: "گزینه‌ی migration نامعتبر است." }),
});

// POST /api/admin/ide/deploy { install, migrate } — شروع deploy (پس‌زمینه) و برگرداندن شناسه
export async function POST(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;

  const limit = checkRateLimit(`ide-deploy:${guard.admin.id}`, DEPLOY_RATE_LIMIT, DEPLOY_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(deployInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const id = await startDeploy(input);
    await ideAudit(guard.admin.id, "deploy", undefined, `id=${id} install=${input.install} migrate=${input.migrate}`);
    return NextResponse.json({ id });
  } catch (error) {
    return ideErrorResponse(error);
  }
}

// GET /api/admin/ide/deploy?id= — وضعیت و لاگ؛ بدون id = آخرین deploy
export async function GET(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  try {
    const id = req.nextUrl.searchParams.get("id") ?? (await latestDeployId());
    if (!id) return NextResponse.json({ status: null });
    return NextResponse.json({ status: await getDeployStatus(id) });
  } catch (error) {
    return ideErrorResponse(error);
  }
}
