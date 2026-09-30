import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { resolveFraudFlag } from "@/lib/affiliateFraud";
import { validateInput, resolveFraudFlagInput, ValidationError } from "@/lib/validation";

// POST /api/admin/affiliate/flags/:id  { resolution }
// بستن هشدار تقلب با نتیجه‌ی بررسی ادمین. فقط admin.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  let input;
  try {
    input = validateInput(resolveFraudFlagInput, await req.json());
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const ok = await resolveFraudFlag(admin.id, params.id, input.resolution);
  if (!ok) {
    return NextResponse.json({ error: "هشدار پیدا نشد یا قبلاً بسته شده است." }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
