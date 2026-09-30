// بازگشت وجه سفارش توسط ادمین.
//
// چه چیزی اتفاق می‌افتد (همه در یک تراکنش، زیر قفل ردیف سفارش):
//   ۱) وضعیت سفارش فقط از مسیر state machine عوض می‌شود:
//        queued              → cancelled   (هنوز پردازش نشده)
//        processing / ready  → failed → refunded
//        failed              → refunded
//      سفارش تحویل‌شده (delivered) یا پرداخت‌نشده بازگشت وجه ندارد.
//   ۲) کل مبلغ پرداخت‌شده‌ی سفارش (totalPriceRial، شامل کارمزد) به کیف پول کاربر برمی‌گردد —
//      حتی اگر از درگاه پرداخت شده باشد، چون برگشت خودکار به کارت ممکن نیست.
//   ۳) اگر سفارش برای معرفِ کاربر کمیسیون ساخته بود، همان کمیسیون برگشت می‌خورد.
//   ۴) برای هر گام OrderEvent با actor ادمین ثبت می‌شود و کاربر اعلان می‌گیرد.
// idempotent: کلید یکتای تراکنش کیف پول و ردیف برگشت کمیسیون، و بررسی وضعیت زیر قفل،
// اجازه‌ی بازگشت وجه دوم را نمی‌دهند.

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assertTransition, REFUND_PATHS, type OrderStatus } from "./orderState";
import { creditWalletInTx } from "./wallet";
import { reverseOrderCommissionInTx } from "./affiliate";
import { createNotification, NOTIFICATION_HREF } from "./notifications";
import { formatOrderNumber } from "./orderNumber";

export class RefundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundError";
  }
}

type OrderRow = { id: string; userId: string; orderNumber: number; status: OrderStatus; totalPriceRial: bigint };

export async function refundOrder(adminId: string, orderId: string, reason: string): Promise<OrderStatus> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<OrderRow[]>`
      SELECT id, "userId", "orderNumber", status::text AS status, "totalPriceRial"
      FROM "Order" WHERE id = ${orderId} FOR UPDATE
    `;
    const order = rows[0];
    if (!order) throw new RefundError("سفارش پیدا نشد.");

    const path = REFUND_PATHS[order.status];
    if (!path) throw new RefundError("این سفارش در وضعیت فعلی قابل بازگشت وجه نیست.");

    const actor = `admin:${adminId}`;
    let current = order.status;
    for (const next of path) {
      assertTransition(current, next);
      await tx.order.update({ where: { id: order.id }, data: { status: next } });
      await tx.orderEvent.create({
        data: { orderId: order.id, fromStatus: current, toStatus: next, actor, note: `بازگشت وجه: ${reason}` },
      });
      current = next;
    }

    const orderNumber = formatOrderNumber(order.orderNumber);
    await creditWalletInTx(
      tx,
      order.userId,
      order.totalPriceRial,
      order.id,
      `بازگشت وجه سفارش ${orderNumber}`,
      `refund:order:${order.id}`,
    );
    await reverseOrderCommissionInTx(tx, order.id);

    await createNotification(tx, {
      userId: order.userId,
      text: `مبلغ سفارش ${orderNumber} به کیف پول شما برگشت داده شد.`,
      href: NOTIFICATION_HREF.orders,
    });

    return current;
  });
}
