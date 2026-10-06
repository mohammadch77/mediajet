import { NextRequest, NextResponse } from "next/server";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { MAX_ZIP_UPLOAD_BYTES, planZipApply } from "@/lib/ide/zip";
import { IdeError } from "@/lib/ide/paths";

// ایستا نشود: وضعیت فلگ محیطی و session باید در هر درخواست خوانده شود، نه موقع build.
export const dynamic = "force-dynamic";

// POST /api/admin/ide/zip/preview — بدنه‌ی خام فایل زیپ (Content-Type: application/zip).
// فقط پیش‌نمایش تغییرات؛ هیچ فایلی تا مرحله‌ی تأیید (apply) عوض نمی‌شود.
export async function POST(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_ZIP_UPLOAD_BYTES) {
    return NextResponse.json({ error: "حجم زیپ بیشتر از ۵۰ مگابایت است." }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length > MAX_ZIP_UPLOAD_BYTES) throw new IdeError("حجم زیپ بیشتر از ۵۰ مگابایت است.", 413);
    return NextResponse.json(await planZipApply(guard.admin.id, buffer));
  } catch (error) {
    return ideErrorResponse(error);
  }
}
