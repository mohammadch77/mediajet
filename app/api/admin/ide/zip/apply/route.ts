import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { ideAudit } from "@/lib/ide/audit";
import { applyZipPlan } from "@/lib/ide/zip";
import { validateInput, ValidationError } from "@/lib/validation";

// ایستا نشود: وضعیت فلگ محیطی و session باید در هر درخواست خوانده شود، نه موقع build.
export const dynamic = "force-dynamic";

const applyInput = z.object({ planId: z.string({ error: "شناسه‌ی پیش‌نمایش الزامی است." }).min(10).max(100) });

// POST /api/admin/ide/zip/apply { planId } — اعمال پیش‌نمایشِ تأییدشده (با پشتیبان‌گیری از فایل‌های جایگزین‌شده)
export async function POST(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;

  let input;
  try {
    input = validateInput(applyInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await applyZipPlan(guard.admin.id, input.planId);
    await ideAudit(guard.admin.id, "zip_apply", undefined, `${result.applied} فایل اعمال شد`);
    return NextResponse.json(result);
  } catch (error) {
    return ideErrorResponse(error);
  }
}
