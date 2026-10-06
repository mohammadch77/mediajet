import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { cancelUnpaidOrderInTx } from "@/lib/orderCancel";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const CANCEL_RATE_LIMIT = 20;
const CANCEL_RATE_WINDOW_MS = 60_000;

// POST /api/orders/:id/cancel
// انصراف کاربر از سفارشِ «در انتظار پرداخت». فقط سفارش خودِ کاربر و فقط پرداخت‌نشده؛
// سفارش پرداخت‌شده از این مسیر لغو نمی‌شود (آن بازگشت وجه ادمین است).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای مدیریت سفارش باید وارد شوید." }, { status: 401 });
  }

  const limit = checkRateLimit(`order-cancel:${currentUser.id}`, CANCEL_RATE_LIMIT, CANCEL_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, userId: currentUser.id }, select: { id: true } });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد." }, { status: 404 });
  }

  const cancelled = await prisma.$transaction((tx) =>
    cancelUnpaidOrderInTx(tx, order.id, currentUser.id, "کاربر از پرداخت سفارش انصراف داد."),
  );
  if (!cancelled) {
    return NextResponse.json({ error: "این سفارش دیگر قابل لغو نیست." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
