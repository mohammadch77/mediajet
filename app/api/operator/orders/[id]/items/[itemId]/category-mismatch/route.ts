import { NextRequest, NextResponse } from "next/server";
import { requireOperator, SessionError } from "@/lib/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { MismatchError, reportCategoryMismatch } from "@/lib/categoryMismatch";
import { validateInput, ValidationError, operatorCategoryMismatchInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

// POST /api/operator/orders/[id]/items/[itemId]/category-mismatch { correctCategory, note? }
// اپراتور دسته‌ی اشتباه آیتم را گزارش می‌کند: اصلاح دسته (قیمت بیشتر نشود) یا بازگشت وجه همین آیتم.
// اختیار فقط برای همین دلیل است (نه بازگشت وجه آزاد) و سقف تعداد در ساعت دارد.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  let operator;
  try {
    operator = await requireOperator();
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }

  const limit = checkRateLimit(`operator-mismatch:${operator.id}`, 20, 60 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });

  let input;
  try {
    input = validateInput(operatorCategoryMismatchInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { id, itemId } = await params;
  try {
    const result = await reportCategoryMismatch(operator.id, id, itemId, input.correctCategory, input.note);
    return NextResponse.json(
      result.kind === "fixed"
        ? { ok: true, kind: "fixed" }
        : { ok: true, kind: "refunded", refundedRial: Number(result.refundedRial), orderClosed: result.orderClosed },
    );
  } catch (error) {
    if (error instanceof MismatchError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
