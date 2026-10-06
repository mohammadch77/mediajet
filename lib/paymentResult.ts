// نتیجه‌ی یک تلاش پرداخت برای نمایش در صفحه‌ی /pay/result.
// فقط صاحب پرداخت می‌تواند نتیجه را ببیند؛ authority به‌تنهایی دسترسی نمی‌دهد.

import { prisma } from "./db";
import { rialToTomanLabel } from "./money";
import { formatOrderNumber } from "./orderNumber";

export type PaymentResult = {
  /** شارژ کیف پول یا پرداخت مستقیم سفارش. */
  kind: "charge" | "order";
  /** pending = هنوز تأیید قطعی با درگاه انجام نشده (initiated یا paid). */
  status: "verified" | "failed" | "pending";
  amountLabel: string;
  refId: string | null;
  createdAt: string;
  orderNumber: string | null;
};

export async function getPaymentResult(userId: string, authority: string): Promise<PaymentResult | null> {
  const payment = await prisma.payment.findUnique({
    where: { authority },
    include: { order: { select: { orderNumber: true } } },
  });
  if (!payment || payment.userId !== userId) return null;

  return {
    kind: payment.orderId ? "order" : "charge",
    status: payment.status === "verified" ? "verified" : payment.status === "failed" ? "failed" : "pending",
    amountLabel: rialToTomanLabel(Number(payment.amountRial)),
    refId: payment.refId,
    createdAt: payment.createdAt.toISOString(),
    orderNumber: payment.order ? formatOrderNumber(payment.order.orderNumber) : null,
  };
}
