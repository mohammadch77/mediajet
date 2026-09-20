import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOperator, SessionError } from "@/lib/session";
import { validateInput, operatorItemDeliverInput, ValidationError } from "@/lib/validation";
import { loadDeliverableItem, markItemReadyAndAdvanceOrder, DeliveryTargetError } from "@/lib/delivery";

// POST /api/operator/orders/[id]/items/[itemId]/deliver
// ثبت لینک فایل تحویلی برای یک آیتم مشخص از سفارش (نه کل سفارش) و پیشروی وضعیت
// سفارش متناسب با وضعیت همه‌ی آیتم‌ها.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  let operator;
  try {
    operator = await requireOperator();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { id, itemId } = await params;

  let input;
  try {
    const body = await req.json();
    input = validateInput(operatorItemDeliverInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  let target;
  try {
    target = await loadDeliverableItem(id, itemId);
  } catch (error) {
    if (error instanceof DeliveryTargetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const actor = `operator:${operator.id}`;
  await prisma.$transaction(async (tx) => {
    await tx.delivery.upsert({
      where: { orderItemId: itemId },
      create: { orderItemId: itemId, fileUrl: input.fileUrl },
      update: { fileUrl: input.fileUrl, storageKey: null, isLarge: false, deliveredAt: new Date() },
    });
    await markItemReadyAndAdvanceOrder(tx, {
      orderId: id,
      orderItemId: itemId,
      fromOrderStatus: target.fromStatus,
      actor,
      note: `ثبت لینک تحویل آیتم ${itemId}`,
    });
  });

  return NextResponse.json({ orderId: id, orderItemId: itemId, itemStatus: "ready", fileUrl: input.fileUrl });
}
