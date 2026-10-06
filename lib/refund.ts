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
import { reverseOrderCommissionInTx, type CommissionReversalResult } from "./affiliate";
import { getTelegramConfig, sendMessage } from "./telegram";
import { rialToTomanLabel } from "./money";
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
  const outcome = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
    // آیتم‌هایی که قبلاً به‌علت «دسته‌ی اشتباه» جداگانه برگشت خورده‌اند (lib/categoryMismatch.ts) دوباره برنمی‌گردند.
    const alreadyRefunded = (await tx.orderItem.aggregate({ where: { orderId: order.id }, _sum: { refundedRial: true } }))._sum.refundedRial ?? 0n;
    const refundAmount: bigint = BigInt(order.totalPriceRial) - BigInt(alreadyRefunded);
    if (refundAmount <= 0n) throw new RefundError("کل مبلغ این سفارش قبلاً به کیف پول برگشت داده شده است.");
    await creditWalletInTx(
      tx,
      order.userId,
      refundAmount,
      order.id,
      `بازگشت وجه سفارش ${orderNumber}`,
      `refund:order:${order.id}`,
    );
    const reversal = await reverseOrderCommissionInTx(tx, order.id);

    await createNotification(tx, {
      userId: order.userId,
      text: `مبلغ سفارش ${orderNumber} به کیف پول شما برگشت داده شد.`,
      href: NOTIFICATION_HREF.orders,
    });

    return { status: current, orderNumber, userId: order.userId, amountRial: refundAmount, reversal };
  });

  notifyFinanceOfRefund(adminId, reason, outcome);
  return outcome.status;
}

/** اطلاع بازگشت وجه (و اگر همکار بدهکار شد، هشدار بدهی) به چت مالی تلگرام؛ هرگز بازگشت وجه را fail نمی‌کند. */
function notifyFinanceOfRefund(
  adminId: string,
  reason: string,
  o: { orderNumber: string; userId: string; amountRial: bigint; reversal: CommissionReversalResult },
): void {
  void (async () => {
    try {
      const chatId = await getTelegramConfig("TELEGRAM_CHAT_FINANCE");
      if (!chatId) return;
      const [customer, admin] = await Promise.all([
        prisma.user.findUnique({ where: { id: o.userId }, select: { mobile: true } }),
        prisma.user.findUnique({ where: { id: adminId }, select: { mobile: true } }),
      ]);
      const lines = [
        "↩️ بازگشت وجه سفارش",
        `سفارش: ${o.orderNumber} · مشتری: ${customer?.mobile ?? "—"}`,
        `مبلغ برگشتی به کیف پول: ${rialToTomanLabel(Number(o.amountRial))}`,
        `دلیل: ${reason} · توسط: ${admin?.mobile ?? adminId}`,
      ];
      if (o.reversal.kind === "cancelled_pending") {
        lines.push(`کمیسیون در انتظار همکار (${rialToTomanLabel(Number(o.reversal.amountRial))}) لغو شد.`);
      } else if (o.reversal.kind === "reversed") {
        lines.push(`کمیسیون همکار (${rialToTomanLabel(Number(o.reversal.amountRial))}) برگشت خورد.`);
      }
      await sendMessage(chatId, lines.join("\n"));

      if (o.reversal.kind === "reversed" && o.reversal.balanceAfter < 0n) {
        const aff = await prisma.user.findUnique({ where: { id: o.reversal.affiliateId }, select: { mobile: true, referralCode: true } });
        await sendMessage(
          chatId,
          [
            "⚠️ همکار بدهکار شد",
            `همکار: ${aff?.mobile ?? "—"} (${aff?.referralCode ?? "—"})`,
            `موجودی فعلی: ${rialToTomanLabel(Number(o.reversal.balanceAfter))}`,
            "کمیسیونِ تسویه‌شده‌ی یک سفارش برگشت خورد؛ بدهی از کمیسیون‌های بعدی کسر می‌شود و تا صاف شدن امکان تسویه ندارد.",
          ].join("\n"),
        );
      }
    } catch (error) {
      console.error("[تلگرام خطا] اطلاع بازگشت وجه ناموفق بود:", error);
    }
  })();
}
