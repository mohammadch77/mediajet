import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOperator, SessionError } from "@/lib/session";
import { canTransition, type OrderStatus } from "@/lib/orderState";
import { validateInput, operatorDeliverInput, ValidationError } from "@/lib/validation";

const TO_STATUS: OrderStatus = "ready";

// POST /api/operator/orders/[id]/deliver
// ثبت لینک فایل تحویلی و انتقال سفارش به ready. فعلاً لینک فایل به‌صورت URL از اپراتور گرفته می‌شود
// (نه آپلود مستقیم فایل)؛ ساده‌تر برای فاز فعلی چون نیازی به ذخیره‌سازی فایل/استوریج ندارد.
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
    input = validateInput(operatorDeliverInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  // TODO(cart-ui): این endpoint فعلاً فقط اولین آیتم سفارش را تحویل می‌دهد؛ وقتی UI سبد
  // خرید ساخته شد باید orderItemId هم از ورودی گرفته شود.
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد." }, { status: 404 });
  }
  const item = order.items[0];
  if (!item) {
    return NextResponse.json({ error: "سفارش بدون آیتم است." }, { status: 422 });
  }

  const fromStatus = order.status as OrderStatus;
  if (!canTransition(fromStatus, TO_STATUS)) {
    return NextResponse.json(
      { error: `انتقال نامعتبر وضعیت سفارش: ${fromStatus} → ${TO_STATUS}` },
      { status: 422 },
    );
  }

  const actor = `operator:${operator.id}`;
  await prisma.$transaction(async (tx) => {
    await tx.delivery.upsert({
      where: { orderItemId: item.id },
      create: { orderItemId: item.id, fileUrl: input.fileUrl },
      update: { fileUrl: input.fileUrl, deliveredAt: new Date() },
    });
    await tx.orderItem.update({ where: { id: item.id }, data: { status: "ready" } });
    await tx.order.update({ where: { id }, data: { status: TO_STATUS } });
    await tx.orderEvent.create({
      data: { orderId: id, fromStatus, toStatus: TO_STATUS, actor, note: "ثبت لینک تحویل" },
    });
  });

  return NextResponse.json({ orderId: id, status: TO_STATUS, fileUrl: input.fileUrl });
}
