import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { AffiliateError, requestPayout } from "@/lib/affiliate";
import { validateInput, affiliatePayoutRequestInput, ValidationError } from "@/lib/validation";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

// POST /api/affiliate/payouts — درخواست تسویه‌ی کارت‌به‌کارت از موجودی کمیسیون.
// هویت فقط از session؛ مبلغ با موجودی دفتر سمت سرور سنجیده می‌شود.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "برای درخواست تسویه باید وارد شوی." }, { status: 401 });
  }

  const limit = checkRateLimit(`affiliate-payout:${user.id}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(affiliatePayoutRequestInput, await req.json());
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    const payout = await requestPayout(user.id, {
      amountRial: BigInt(input.amountRial),
      cardNumber: input.cardNumber,
      cardHolder: input.cardHolder,
      idempotencyKey: input.idempotencyKey,
    });
    return NextResponse.json({ id: payout.id, status: payout.status });
  } catch (error) {
    if (error instanceof AffiliateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
