import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOperator, SessionError } from "@/lib/session";
import { canTransition, type OrderStatus } from "@/lib/orderState";
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

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد." }, { status: 404 });
  }

  const fromStatus = order.status as OrderStatus;
  if (!canTransition(fromStatus, input.toStatus)) {
    return NextResponse.json(
      { error: `انتقال نامعتبر وضعیت سفارش: ${fromStatus} → ${input.toStatus}` },
      { status: 422 },
    );
  }

  const actor = `operator:${operator.id}`;
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id }, data: { status: input.toStatus } });
    await tx.orderEvent.create({
      data: { orderId: id, fromStatus, toStatus: input.toStatus, actor, note: input.note ?? null },
    });
  });

  return NextResponse.json({ orderId: id, status: input.toStatus });
}
