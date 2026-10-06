// «دسته‌ی اشتباه»: لایه‌ی دفاعی نهایی. اگر کاربر یا تشخیص خودکار دسته را غلط انتخاب کرده باشد،
// اپراتور موقع دانلود آن را می‌بیند و (در یک تراکنش اتمیک زیر قفل سفارش) یکی از دو کار انجام می‌شود:
//   ۱) قیمت دسته‌ی درست بیشتر از مبلغ پایه‌ی پرداخت‌شده نیست → فقط دسته‌ی آیتم اصلاح می‌شود، بدون بازگشت وجه.
//   ۲) قیمت دسته‌ی درست بیشتر است → آیتم لغو (rejected) می‌شود، سهم همین آیتم (قیمت پایه + سهم متناسب
//      کارمزد روش پرداخت) به کیف پول برمی‌گردد و به کاربر پیام می‌رود دوباره با دسته‌ی درست ثبت کند.
// بقیه‌ی آیتم‌های سفارش دست نمی‌خورند. اگر همه‌ی آیتم‌ها لغو شوند، سفارش از مسیر state machine بسته می‌شود
// و کمیسیون همکار برگشت می‌خورد. در حالت جزئی (فقط یک آیتم از چند آیتم) کمیسیون همکار دست نمی‌خورد.

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { categoryById, sitePriceRial } from "@/data/categories";
import { assertTransition, REFUND_PATHS, type OrderStatus } from "./orderState";
import { creditWalletInTx } from "./wallet";
import { advanceOrderStatusFromItems } from "./delivery";
import { reverseOrderCommissionInTx } from "./affiliate";
import { createNotification, NOTIFICATION_HREF } from "./notifications";
import { formatOrderNumber } from "./orderNumber";
import { rialToTomanLabel } from "./money";
import { categoryTitle } from "@/data/categories";
import { getTelegramConfig, sendMessage } from "./telegram";

export class MismatchError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
    this.name = "MismatchError";
  }
}

/** با دسته‌ی درست چه باید کرد؟ فقط وقتی قیمت دسته‌ی درست بیشتر است بازگشت وجه لازم است. */
export function planMismatch(paidBaseRial: bigint, correctPriceRial: number): "fix_category" | "refund_item" {
  return BigInt(correctPriceRial) > paidBaseRial ? "refund_item" : "fix_category";
}

/**
 * سهم یک آیتم از کل مبلغ پرداخت‌شده‌ی سفارش (شامل کارمزد روش پرداخت)، بدون گرد کردن اعشاری.
 * آیتمِ آخرِ فعال باقیمانده‌ی دقیق را می‌گیرد تا مجموع برگشتی هیچ‌وقت از مبلغ پرداخت‌شده بیشتر یا کمتر نشود.
 */
export function itemRefundShare(p: {
  paidTotalRial: bigint;
  itemBaseRial: bigint;
  baseSumRial: bigint;
  refundedSoFarRial: bigint;
  isLastActiveItem: boolean;
}): bigint {
  if (p.baseSumRial <= 0n) throw new MismatchError("مبلغ پایه‌ی سفارش نامعتبر است.");
  const share = p.isLastActiveItem ? p.paidTotalRial - p.refundedSoFarRial : (p.paidTotalRial * p.itemBaseRial) / p.baseSumRial;
  if (share <= 0n) throw new MismatchError("مبلغی برای بازگشت باقی نمانده است.");
  return share;
}

type OrderLockRow = { id: string; userId: string; orderNumber: number; status: OrderStatus; totalPriceRial: bigint };

export type MismatchResult =
  | { kind: "fixed"; from: string; to: string }
  | { kind: "refunded"; refundedRial: bigint; orderNumber: string; orderClosed: boolean; userId: string; from: string; to: string; itemIndex: number };

const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["queued", "processing", "ready"];

export async function reportCategoryMismatch(
  operatorId: string,
  orderId: string,
  itemId: string,
  correctCategoryId: string,
  note?: string,
): Promise<MismatchResult> {
  const actor = `operator:${operatorId}`;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<OrderLockRow[]>`
      SELECT id, "userId", "orderNumber", status::text AS status, "totalPriceRial"
      FROM "Order" WHERE id = ${orderId} FOR UPDATE
    `;
    const order = rows[0];
    if (!order) throw new MismatchError("سفارش پیدا نشد.", 404);
    if (!ACTIVE_ORDER_STATUSES.includes(order.status)) {
      throw new MismatchError("این سفارش در وضعیتی نیست که بتوان دسته‌ی آیتمش را اصلاح کرد.");
    }

    const items = await tx.orderItem.findMany({ where: { orderId }, orderBy: { position: "asc" } });
    const index = items.findIndex((i) => i.id === itemId);
    const item = items[index];
    if (!item) throw new MismatchError("آیتم پیدا نشد.", 404);
    if (item.status !== "pending") throw new MismatchError("فقط آیتمی که هنوز تحویل نشده قابل اصلاح است.");

    const correct = categoryById(correctCategoryId);
    if (!correct) throw new MismatchError("دسته‌ی انتخاب‌شده نامعتبر است.", 400);
    if (correct.id === item.category) throw new MismatchError("دسته‌ی انتخاب‌شده همان دسته‌ی فعلی است.");
    const correctPrice = sitePriceRial(correct.id, item.sourceSite);
    if (correctPrice === undefined) throw new MismatchError("این سایت دسته‌ی انتخاب‌شده را پشتیبانی نمی‌کند.");

    const orderNumber = formatOrderNumber(order.orderNumber);
    const base = { mismatchFrom: item.category, mismatchTo: correct.id, mismatchById: operatorId, mismatchAt: new Date(), mismatchNote: note ?? null };
    const itemLabel = `آیتم ${index + 1}`;

    if (planMismatch(item.priceRial, correctPrice) === "fix_category") {
      await tx.orderItem.update({ where: { id: item.id }, data: { ...base, category: correct.id } });
      await tx.orderEvent.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          actor,
          note: `اصلاح دسته‌ی ${itemLabel}: ${categoryTitle(item.category)} ← ${categoryTitle(correct.id)}${note ? ` (${note})` : ""}`,
        },
      });
      return { kind: "fixed", from: item.category, to: correct.id } as const;
    }

    // بازگشت وجه فقط‌ِ همین آیتم
    const others = items.filter((i) => i.id !== item.id);
    const activeOthers = others.filter((i) => i.status !== "rejected");
    const baseSum = items.reduce((sum, i) => sum + i.priceRial, 0n);
    const refundedSoFar = items.reduce((sum, i) => sum + i.refundedRial, 0n);
    const refund = itemRefundShare({
      paidTotalRial: order.totalPriceRial,
      itemBaseRial: item.priceRial,
      baseSumRial: baseSum,
      refundedSoFarRial: refundedSoFar,
      isLastActiveItem: activeOthers.length === 0,
    });

    await tx.orderItem.update({ where: { id: item.id }, data: { ...base, status: "rejected", refundedRial: refund } });
    await creditWalletInTx(
      tx,
      order.userId,
      refund,
      order.id,
      `بازگشت وجه ${itemLabel} سفارش ${orderNumber} (دسته‌ی اشتباه)`,
      `refund:item:${item.id}`,
    );
    await tx.orderEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: order.status,
        actor,
        note: `دسته‌ی اشتباه ${itemLabel}: ${categoryTitle(item.category)} ← ${categoryTitle(correct.id)}؛ ${rialToTomanLabel(Number(refund))} به کیف پول برگشت${note ? ` (${note})` : ""}`,
      },
    });

    let orderClosed = false;
    if (activeOthers.length === 0) {
      // همه‌ی آیتم‌ها لغو شده‌اند: سفارش از مسیر state machine بسته می‌شود (بدون برگشت دوباره‌ی پول).
      orderClosed = true;
      const path = REFUND_PATHS[order.status] ?? [];
      let current = order.status;
      for (const next of path) {
        assertTransition(current, next);
        await tx.order.update({ where: { id: order.id }, data: { status: next } });
        await tx.orderEvent.create({ data: { orderId, fromStatus: current, toStatus: next, actor, note: "همه‌ی آیتم‌ها به‌علت دسته‌ی اشتباه لغو شد" } });
        current = next;
      }
      await reverseOrderCommissionInTx(tx, order.id);
    } else if (order.status !== "queued") {
      await advanceOrderStatusFromItems(tx, orderId, order.status, actor, "تحویل سایر آیتم‌ها پس از لغو آیتم دسته‌ی اشتباه");
    }

    await createNotification(tx, {
      userId: order.userId,
      text:
        `${itemLabel} سفارش ${orderNumber} با دسته‌ی «${categoryTitle(item.category)}» ثبت شده بود، ولی دسته‌ی درست «${categoryTitle(correct.id)}» است. ` +
        `${rialToTomanLabel(Number(refund))} به کیف پولت برگشت؛ لطفاً دوباره با دسته‌ی درست ثبت کن.`,
      href: NOTIFICATION_HREF.orders,
    });

    return { kind: "refunded", refundedRial: refund, orderNumber, orderClosed, userId: order.userId, from: item.category, to: correct.id, itemIndex: index + 1 } as const;
  });

  if (result.kind === "refunded") notifyFinance(operatorId, result);
  return result;
}

/** اطلاع به چت مالی تلگرام؛ هرگز عملیات را fail نمی‌کند. */
function notifyFinance(operatorId: string, r: Extract<MismatchResult, { kind: "refunded" }>): void {
  void (async () => {
    try {
      const chatId = await getTelegramConfig("TELEGRAM_CHAT_FINANCE");
      if (!chatId) return;
      const [customer, operator] = await Promise.all([
        prisma.user.findUnique({ where: { id: r.userId }, select: { mobile: true } }),
        prisma.user.findUnique({ where: { id: operatorId }, select: { mobile: true } }),
      ]);
      await sendMessage(
        chatId,
        [
          "↩️ بازگشت وجه (دسته‌ی اشتباه)",
          `سفارش: ${r.orderNumber} · آیتم ${r.itemIndex} · مشتری: ${customer?.mobile ?? "—"}`,
          `ثبت‌شده: ${categoryTitle(r.from)} ← درست: ${categoryTitle(r.to)}`,
          `مبلغ برگشتی به کیف پول: ${rialToTomanLabel(Number(r.refundedRial))}${r.orderClosed ? " · سفارش بسته شد" : ""}`,
          `توسط اپراتور: ${operator?.mobile ?? operatorId}`,
        ].join("\n"),
      );
    } catch (error) {
      console.error("[تلگرام خطا] اطلاع دسته‌ی اشتباه ناموفق بود:", error);
    }
  })();
}
