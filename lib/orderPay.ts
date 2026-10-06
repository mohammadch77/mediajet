// پرداخت یک سفارش «در انتظار پرداخت» (پرداخت درگاهی ناتمام): قیمت دو روش و پرداخت با کیف پول.
// پرداخت درگاهی همچنان از /api/orders/[id]/pay (POST) انجام می‌شود.

import { prisma } from "./db";
import { computeCartTotal } from "./pricing";
import { debitWalletInTx, ensureWallet, WalletError } from "./wallet";
import { accrueOrderCommissionInTx } from "./affiliate";
import { assertTransition } from "./orderState";
import { clearCartInTx } from "./cart";
import { formatOrderNumber } from "./orderNumber";

export class OrderPayError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "OrderPayError";
  }
}

export type OrderPayQuote = {
  orderId: string;
  gatewayTotalRial: bigint;
  walletTotalRial: bigint;
  walletBalanceRial: bigint;
};

const NOT_PAYABLE = "این سفارش دیگر قابل پرداخت نیست.";

/** قیمت سفارش با هر دو روش پرداخت + موجودی کیف پول؛ هرگز چیزی را تغییر نمی‌دهد. */
export async function getOrderPayQuote(userId: string, orderId: string): Promise<OrderPayQuote> {
  // فقط سفارشِ خودِ کاربر؛ سفارش دیگران مثل سفارش ناموجود جواب می‌دهد.
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!order) throw new OrderPayError("سفارش یافت نشد.", 404);
  if (order.status !== "awaiting_payment") throw new OrderPayError(NOT_PAYABLE, 409);

  const wallet = await computeCartTotal(
    order.items.map((item) => ({ categoryId: item.category, site: item.sourceSite })),
    "wallet",
  );
  if (!wallet) throw new OrderPayError("محاسبه‌ی قیمت سفارش با خطا مواجه شد.", 422);

  const balance = (await ensureWallet(userId)).balanceRial;
  return {
    orderId: order.id,
    // مبلغ درگاهی همان مبلغ ثبت‌شده‌ی سفارش است (همان که پرداخت مجدد درگاهی از آن می‌گیرد).
    gatewayTotalRial: order.totalPriceRial,
    walletTotalRial: BigInt(wallet.payableTotalRial),
    walletBalanceRial: balance,
  };
}

/**
 * پرداخت سفارش در انتظار پرداخت از کیف پول: اتمیک و idempotent.
 * قیمت دوباره سمت سرور با کارمزد روش «کیف پول» محاسبه و روی سفارش ثبت می‌شود، کسر از کیف پول
 * و صف‌شدن سفارش در یک تراکنش اتفاق می‌افتد و تلاش‌های درگاهیِ باز ناموفق می‌شوند تا callback
 * دیرهنگامشان اثری نداشته باشد.
 */
export async function payOrderWithWallet(
  userId: string,
  orderId: string,
): Promise<{ orderId: string; priceRial: bigint; balanceAfterRial: bigint; productUrls: string[] }> {
  const owned = await prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true } });
  if (!owned) throw new OrderPayError("سفارش یافت نشد.", 404);

  try {
    return await prisma.$transaction(async (tx) => {
      // قفل ردیف سفارش: با callback هم‌زمان درگاه و با انصراف کاربر سریالی می‌شود.
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT status::text AS status FROM "Order" WHERE id = ${orderId} FOR UPDATE
      `;
      if (rows[0]?.status !== "awaiting_payment") throw new OrderPayError(NOT_PAYABLE, 409);

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { orderBy: { position: "asc" } } },
      });

      const priced = await computeCartTotal(
        order.items.map((item) => ({ categoryId: item.category, site: item.sourceSite })),
        "wallet",
      );
      if (!priced) throw new OrderPayError("محاسبه‌ی قیمت سفارش با خطا مواجه شد.", 422);
      const totalRial = BigInt(priced.payableTotalRial);

      await ensureWallet(userId);
      const debit = await debitWalletInTx(
        tx,
        userId,
        totalRial,
        order.id,
        `پرداخت سفارش ${formatOrderNumber(order.orderNumber)}`,
        `order-wallet-pay:${order.id}`,
      );

      await tx.payment.updateMany({
        where: { orderId: order.id, status: "initiated" },
        data: { status: "failed" },
      });

      assertTransition("awaiting_payment", "queued");
      await tx.order.update({
        where: { id: order.id },
        data: { status: "queued", paymentMethod: "wallet", totalPriceRial: totalRial },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: "awaiting_payment",
          toStatus: "queued",
          actor: `user:${userId}`,
          note: "پرداخت از کیف پول (پس از ناتمام ماندن پرداخت درگاهی).",
        },
      });

      await accrueOrderCommissionInTx(tx, order.id);
      if (order.cartCheckout) await clearCartInTx(tx, userId);

      return {
        orderId: order.id,
        priceRial: totalRial,
        balanceAfterRial: debit.balanceAfter,
        productUrls: order.items.map((item) => item.productUrl),
      };
    });
  } catch (error) {
    if (error instanceof WalletError) throw new OrderPayError(error.message, 422);
    throw error;
  }
}
