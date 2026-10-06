import { NextRequest, NextResponse } from "next/server";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { ideAudit } from "@/lib/ide/audit";
import { createTextFile, deleteFile, readTextFile, saveTextFile } from "@/lib/ide/files";
import { validateInput, ValidationError, ideCreateInput, ideSaveInput } from "@/lib/validation";

async function parseBody<T>(req: NextRequest, schema: Parameters<typeof validateInput>[0]): Promise<T | NextResponse> {
  try {
    return validateInput(schema, await req.json()) as T;
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET /api/admin/ide/file?path= — خواندن
export async function GET(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  try {
    return NextResponse.json(await readTextFile(req.nextUrl.searchParams.get("path") ?? ""));
  } catch (error) {
    return ideErrorResponse(error);
  }
}

// PUT /api/admin/ide/file { path, content, baseSha } — ذخیره‌ی فایل موجود
export async function PUT(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  const body = await parseBody<{ path: string; content: string; baseSha: string }>(req, ideSaveInput);
  if (body instanceof NextResponse) return body;
  try {
    const result = await saveTextFile(body.path, body.content, body.baseSha);
    await ideAudit(guard.admin.id, "save", result.path, `${result.size} بایت`);
    return NextResponse.json(result);
  } catch (error) {
    return ideErrorResponse(error);
  }
}

// POST /api/admin/ide/file { path, content? } — ساخت فایل جدید
export async function POST(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  const body = await parseBody<{ path: string; content?: string }>(req, ideCreateInput);
  if (body instanceof NextResponse) return body;
  try {
    const result = await createTextFile(body.path, body.content ?? "");
    await ideAudit(guard.admin.id, "create", result.path);
    return NextResponse.json(result);
  } catch (error) {
    return ideErrorResponse(error);
  }
}

// DELETE /api/admin/ide/file?path= — حذف فایل (با پشتیبان)
export async function DELETE(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  try {
    const path = await deleteFile(req.nextUrl.searchParams.get("path") ?? "");
    await ideAudit(guard.admin.id, "delete", path);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return ideErrorResponse(error);
  }
}
