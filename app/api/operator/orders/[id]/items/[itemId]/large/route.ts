import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOperator, SessionError } from "@/lib/session";
import { loadDeliverableItem, markItemLargeAndNotifyUser, DeliveryTargetError } from "@/lib/delivery";
import { toPersianDigits } from "@/lib/money";

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
  const itemIndex = [...target.order.items]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .findIndex((i) => i.id === itemId);
  await prisma.$transaction(async (tx) => {
    await markItemLargeAndNotifyUser(tx, {
      orderId: id,
      orderItemId: itemId,
      userId: target.order.userId,
      itemLabel: toPersianDigits(itemIndex + 1),
      fromOrderStatus: target.fromStatus,
      actor,
      note: `علامت‌گذاری آیتم ${itemId} به‌عنوان فایل بزرگ`,
    });
  });

  return NextResponse.json({ orderId: id, orderItemId: itemId, itemStatus: "ready", isLarge: true });
}
