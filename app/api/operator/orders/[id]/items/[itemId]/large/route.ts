import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOperator, SessionError } from "@/lib/session";
import { loadDeliverableItem, markItemReadyAndAdvanceOrder, DeliveryTargetError } from "@/lib/delivery";

// POST /api/operator/orders/[id]/items/[itemId]/large
// یک آیتم را «فایل بزرگ» علامت می‌زند (بدون ذخیره‌ی فایل)؛ کاربر در پنل خودش به‌جای
// دانلود، پیام هدایت به پشتیبانی می‌بیند.
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
      create: { orderItemId: itemId, isLarge: true },
      update: { isLarge: true, fileUrl: null, storageKey: null, deliveredAt: new Date() },
    });
    await markItemReadyAndAdvanceOrder(tx, {
      orderId: id,
      orderItemId: itemId,
      fromOrderStatus: target.fromStatus,
      actor,
      note: `علامت‌گذاری آیتم ${itemId} به‌عنوان فایل بزرگ`,
    });
  });

  return NextResponse.json({ orderId: id, orderItemId: itemId, itemStatus: "ready", isLarge: true });
}
