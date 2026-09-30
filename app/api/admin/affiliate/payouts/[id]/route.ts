import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { AffiliateError, reviewPayout } from "@/lib/affiliate";
import { validateInput, affiliatePayoutReviewInput, ValidationError } from "@/lib/validation";

// POST /api/admin/affiliate/payouts/:id  { action: "paid", bankRef } | { action: "rejected", note }
// بررسی درخواست تسویه. فقط admin. رد درخواست، مبلغ را به موجودی همکار برمی‌گرداند.
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
    input = validateInput(affiliatePayoutReviewInput, await req.json());
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    const payout = await reviewPayout(admin.id, params.id, input);
    return NextResponse.json({ id: payout.id, status: payout.status });
  } catch (error) {
    if (error instanceof AffiliateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
