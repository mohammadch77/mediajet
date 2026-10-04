import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { refundOrder, RefundError } from "@/lib/refund";
import { WalletError } from "@/lib/wallet";
import { validateInput, refundOrderInput, ValidationError } from "@/lib/validation";

// POST /api/admin/orders/:id/refund  { reason }
// بازگشت وجه سفارش به کیف پول کاربر + برگشت کمیسیون همکار. فقط admin.
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
    input = validateInput(refundOrderInput, await req.json());
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    const status = await refundOrder(admin.id, params.id, input.reason);
    return NextResponse.json({ status });
  } catch (error) {
    if (error instanceof RefundError || error instanceof WalletError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    // هر خطای پیش‌بینی‌نشده‌ی دیگر هم باید پیام فارسی JSON بدهد، نه صفحه‌ی خالی ۵۰۰.
    console.error("[admin refund]", error);
    return NextResponse.json({ error: "بازگشت وجه انجام نشد؛ خطای داخلی سرور." }, { status: 500 });
  }
}
