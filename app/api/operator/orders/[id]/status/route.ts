import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOperator, SessionError } from "@/lib/session";
import { ADMIN_ONLY_STATUSES, canTransition, type OrderStatus } from "@/lib/orderState";
import { onOrderStatusChangedInTx } from "@/lib/affiliate";
import { validateInput, operatorStatusInput, ValidationError } from "@/lib/validation";

// POST /api/operator/orders/[id]/status
// تغییر وضعیت سفارش توسط اپراتور؛ فقط انتقال‌های مجاز طبق state machine پذیرفته می‌شوند.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let operator;
  try {
    operator = await requireOperator();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { id } = await params;

  let input;
  try {
    const body = await req.json();
    input = validateInput(operatorStatusInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  // لغو و بازگشت وجه جابه‌جایی پول دارند (برگشت به کیف پول + برگشت کمیسیون همکار)؛ فقط از مسیر
  // بازگشت وجه ادمین (lib/refund.ts) مجازند، نه تغییر وضعیت ساده‌ی اپراتور.
  if (ADMIN_ONLY_STATUSES.includes(input.toStatus)) {
    return NextResponse.json(
      { error: "لغو یا بازگشت وجه سفارش فقط از پنل ادمین (بخش بازگشت وجه) ممکن است تا پول کاربر برگردد." },
      { status: 422 },
    );
  }

  const actor = `operator:${operator.id}`;
  const result = await prisma.$transaction(async (tx) => {
    // خواندن وضعیت زیر قفل ردیف تا دو تغییر هم‌زمان از روی یک وضعیت قدیمی انجام نشوند.
    const rows = await tx.$queryRaw<{ status: OrderStatus }[]>`
      SELECT status::text AS status FROM "Order" WHERE id = ${id} FOR UPDATE
    `;
    if (!rows[0]) return { error: "سفارش یافت نشد.", code: 404 } as const;
    const fromStatus = rows[0].status;
    if (!canTransition(fromStatus, input.toStatus)) {
      return { error: `انتقال نامعتبر وضعیت سفارش: ${fromStatus} → ${input.toStatus}`, code: 422 } as const;
    }

    await tx.order.update({ where: { id }, data: { status: input.toStatus } });
    await tx.orderEvent.create({
      data: { orderId: id, fromStatus, toStatus: input.toStatus, actor, note: input.note ?? null },
    });
    await onOrderStatusChangedInTx(tx, id, input.toStatus);
    return null;
  });
  if (result) {
    return NextResponse.json({ error: result.error }, { status: result.code });
  }

  return NextResponse.json({ orderId: id, status: input.toStatus });
}
