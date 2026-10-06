import { NextRequest, NextResponse } from "next/server";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { ideAudit } from "@/lib/ide/audit";
import { restoreVersion } from "@/lib/ide/files";
import { validateInput, ValidationError, ideRestoreInput } from "@/lib/validation";

// POST /api/admin/ide/restore { path, versionId } — بازگرداندن یک نسخه‌ی پشتیبان
export async function POST(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;

  let input;
  try {
    input = validateInput(ideRestoreInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const result = await restoreVersion(input.path, input.versionId);
    await ideAudit(guard.admin.id, "restore", result.path, `نسخه ${input.versionId}`);
    return NextResponse.json(result);
  } catch (error) {
    return ideErrorResponse(error);
  }
}
