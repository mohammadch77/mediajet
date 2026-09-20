// منطق تأیید بازگشت از درگاه پرداخت و شارژ اتمیک کیف پول.

import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma } from "./db";
import { getGateway } from "./gateway";
import { creditWalletInTx } from "./wallet";
import { clearCartInTx } from "./cart";
import { assertTransition, type OrderStatus } from "./orderState";

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

type PaymentRow = {
  id: string;
  userId: string;
  orderId: string | null;
  amountRial: bigint;
  status: PaymentStatus;
  idempotencyKey: string;
};

async function lockPayment(tx: Prisma.TransactionClient, authority: string): Promise<PaymentRow> {
  const rows = await tx.$queryRaw<PaymentRow[]>`
    SELECT id, "userId", "orderId", "amountRial", status, "idempotencyKey"
    FROM "Payment" WHERE authority = ${authority} FOR UPDATE
  `;
  const payment = rows[0];
  if (!payment) {
    throw new PaymentError("پرداخت یافت نشد.");
  }
  return payment;
}

/**
 * بعد از بازگشت کاربر از درگاه فراخوانی می‌شود.
 * اتمیک و idempotent: اگر پرداخت قبلاً verified یا failed شده باشد، دوباره پردازش نمی‌شود
 * و کیف پول دوباره شارژ نمی‌گردد. مبلغ نهایی همیشه از رکورد Payment سمت سرور خوانده می‌شود،
 * هرگز از پارامترهای callback.
 */
export async function confirmCharge(
  authority: string,
  gatewayStatusOk: boolean,
): Promise<{ status: PaymentStatus }> {
  const gateway = await getGateway();

  return prisma.$transaction(async (tx) => {
    const payment = await lockPayment(tx, authority);

    // پرداخت قبلاً به نتیجه‌ی نهایی رسیده؛ callback تکراری چیزی تغییر نمی‌دهد.
    if (payment.status === "verified" || payment.status === "failed") {
      return { status: payment.status };
    }

    if (!gatewayStatusOk) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return { status: "failed" as PaymentStatus };
    }

    await tx.payment.update({ where: { id: payment.id }, data: { status: "paid" } });

    const verifyResult = await gateway.verifyPayment(authority, payment.amountRial);
    if (!verifyResult.ok) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return { status: "failed" as PaymentStatus };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "verified", refId: verifyResult.refId ?? null },
    });

    await creditWalletInTx(
      tx,
      payment.userId,
      payment.amountRial,
      payment.id,
      "شارژ کیف پول",
      payment.idempotencyKey,
    );

    return { status: "verified" as PaymentStatus };
  });
}

// ---------------------------------------------------------------------------
// پرداخت مستقیم سفارش از درگاه (خواهر جریان شارژ کیف پول در بالا)
// ---------------------------------------------------------------------------

type OrderRow = { id: string; status: OrderStatus; totalPriceRial: bigint; cartCheckout: boolean };

async function lockOrder(tx: Prisma.TransactionClient, orderId: string): Promise<OrderRow> {
  const rows = await tx.$queryRaw<OrderRow[]>`
    SELECT id, status::text AS status, "totalPriceRial", "cartCheckout"
    FROM "Order" WHERE id = ${orderId} FOR UPDATE
  `;
  const order = rows[0];
  if (!order) {
    throw new PaymentError("سفارش یافت نشد.");
  }
  return order;
}

/**
 * رویداد audit برای شکست پرداخت. این یک انتقال وضعیت نیست (سفارش در همان
 * awaiting_payment می‌ماند تا کاربر بتواند دوباره تلاش کند)، فقط ثبت دلیل شکست است.
 * جدول OrderEvent فقط-افزودنی است، پس ثبت رویداد بدون تغییر وضعیت هم مجاز است.
 */
async function recordPaymentFailure(
  tx: Prisma.TransactionClient,
  order: OrderRow,
  reason: string,
): Promise<void> {
  await tx.orderEvent.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      actor: "system",
      note: reason,
    },
  });
}

export type OrderPaymentResult = {
  status: PaymentStatus;
  orderId: string;
  orderStatus: OrderStatus;
  /** فقط وقتی پرداخت در همین فراخوانی تأیید و سفارش به صف رفت، مقدار دارد (برای اطلاع‌رسانی تلگرام). */
  queued: { orderId: string; priceRial: bigint } | null;
};

/**
 * بعد از بازگشت کاربر از درگاه برای پرداخت مستقیم یک سفارش فراخوانی می‌شود.
 *
 * اتمیک و idempotent، دقیقاً مثل confirmCharge: رکورد Payment با قفل ردیف خوانده می‌شود
 * و اگر قبلاً verified یا failed شده باشد، callback تکراری هیچ اثری ندارد (نه پرداخت دوم،
 * نه صف‌شدن دوباره‌ی سفارش). مبلغ همیشه از رکورد Payment سمت سرور خوانده می‌شود،
 * هرگز از پارامترهای callback.
 *
 * اگر تأیید درگاه ناموفق باشد، سفارش به هیچ عنوان به queued نمی‌رود؛ در awaiting_payment
 * می‌ماند و دلیل شکست در OrderEvent ثبت می‌شود.
 */
export async function confirmOrderPayment(
  authority: string,
  gatewayStatusOk: boolean,
): Promise<OrderPaymentResult> {
  const gateway = await getGateway();

  return prisma.$transaction(async (tx) => {
    const payment = await lockPayment(tx, authority);

    if (!payment.orderId) {
      throw new PaymentError("این پرداخت مربوط به سفارش نیست.");
    }

    const order = await lockOrder(tx, payment.orderId);

    // پرداخت قبلاً به نتیجه‌ی نهایی رسیده؛ callback تکراری چیزی تغییر نمی‌دهد.
    if (payment.status === "verified" || payment.status === "failed") {
      return {
        status: payment.status,
        orderId: order.id,
        orderStatus: order.status,
        queued: null,
      };
    }

    if (!gatewayStatusOk) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      await recordPaymentFailure(tx, order, "پرداخت از سوی کاربر لغو شد یا درگاه آن را ناموفق اعلام کرد.");
      return {
        status: "failed" as PaymentStatus,
        orderId: order.id,
        orderStatus: order.status,
        queued: null,
      };
    }

    await tx.payment.update({ where: { id: payment.id }, data: { status: "paid" } });

    const verifyResult = await gateway.verifyPayment(authority, payment.amountRial);
    if (!verifyResult.ok) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      await recordPaymentFailure(tx, order, "تأیید پرداخت نزد درگاه ناموفق بود.");
      return {
        status: "failed" as PaymentStatus,
        orderId: order.id,
        orderStatus: order.status,
        queued: null,
      };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "verified", refId: verifyResult.refId ?? null },
    });

    // انتقال وضعیت فقط از مسیر state machine؛ انتقال نامعتبر کل تراکنش را rollback می‌کند.
    assertTransition(order.status, "queued");
    await tx.order.update({ where: { id: order.id }, data: { status: "queued" } });
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "queued",
        actor: "system",
        note: "پرداخت مستقیم از درگاه تأیید شد.",
      },
    });

    // فقط سفارش‌هایی که از تسویه‌ی سبد خرید ساخته شده‌اند سبد کاربر را خالی می‌کنند؛
    // سفارش تکی اصلاً از سبد عبور نکرده، پس نباید سبدِ نامرتبط کاربر را پاک کند.
    if (order.cartCheckout) {
      await clearCartInTx(tx, payment.userId);
    }

    return {
      status: "verified" as PaymentStatus,
      orderId: order.id,
      orderStatus: "queued" as OrderStatus,
      queued: { orderId: order.id, priceRial: order.totalPriceRial },
    };
  });
}
