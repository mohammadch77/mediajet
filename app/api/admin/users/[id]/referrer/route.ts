import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { AffiliateError, setReferrer } from "@/lib/affiliate";
import { validateInput, setReferrerInput, ValidationError } from "@/lib/validation";

// POST /api/admin/users/:id/referrer  { code: "ABCDEFG" | null, reason }
// تغییر یا حذف معرفِ کاربر. فقط admin؛ در AffiliateAdminLog ثبت می‌شود.
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
    input = validateInput(setReferrerInput, await req.json());
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    await setReferrer(admin.id, params.id, input.code, input.reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AffiliateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
