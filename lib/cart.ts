// منطق پایه‌ی سبد خرید. سبد فقط برای کاربر لاگین‌کرده وجود دارد (هر کاربر حداکثر یک
// سبد باز) تا با بستن مرورگر یا تعویض دستگاه از بین نرود.
//
// نکته‌ی مهم: priceRial ذخیره‌شده روی CartItem فقط کش نمایشی است. مبنای پرداخت واقعی
// همیشه lib/pricing.ts#computeCartTotal است که در لحظه‌ی ثبت سفارش دوباره سمت سرور
// محاسبه می‌شود؛ قیمت کش‌شده‌ی سبد هرگز مستقیماً به سفارش منتقل نمی‌شود.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computePrice } from "@/lib/pricing";

export class CartError extends Error {}

/** سبد باز کاربر را برمی‌گرداند؛ اگر وجود نداشت می‌سازد. */
export async function getOrCreateCart(userId: string) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

export async function getCartItems(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  return cart?.items ?? [];
}

/** آیتمی به سبد اضافه می‌کند؛ دسته/سایت را همان‌جا با computePrice معتبر می‌سنجد. */
export async function addCartItem(
  userId: string,
  input: { categoryId: string; site: string; productUrl: string },
) {
  const price = computePrice(input.categoryId, input.site);
  if (!price) {
    throw new CartError("دسته یا سایت نامعتبر است.");
  }

  const cart = await getOrCreateCart(userId);
  return prisma.cartItem.create({
    data: {
      cartId: cart.id,
      category: input.categoryId,
      sourceSite: price.site,
      productUrl: input.productUrl,
      priceRial: BigInt(price.finalPriceRial),
    },
  });
}

/** فقط آیتمِ متعلق به سبدِ همین کاربر حذف می‌شود؛ در غیر این صورت خطا می‌دهد. */
export async function removeCartItem(userId: string, cartItemId: string) {
  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: { cart: true },
  });
  if (!item || item.cart.userId !== userId) {
    throw new CartError("آیتم سبد یافت نشد.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.cartItem.delete({ where: { id: cartItemId } });
    await cancelStaleCheckoutOrdersInTx(tx, userId, item.productUrl);
  });
}

/**
 * سفارشِ ساخته‌شده از تسویه‌ی سبد که هنوز پرداخت نشده، تا وقتی آیتمش در سبد است قابل پرداخت است.
 * وقتی کاربر آن آیتم را از سبد حذف کرد، سفارش «در انتظار پرداخت»ِ مربوط لغو می‌شود (نه حذف فیزیکی:
 * audit trail فقط‌افزودنی است) و در فهرست سفارش‌های کاربر نمایش داده نمی‌شود (app/api/orders GET).
 * شرط status داخل updateMany، لغو را با callback هم‌زمان درگاه اتمیک می‌کند: سفارشِ همین لحظه
 * پرداخت‌شده (queued) دست نمی‌خورد. تلاش پرداخت باز همان سفارش هم failed می‌شود.
 */
async function cancelStaleCheckoutOrdersInTx(tx: Prisma.TransactionClient, userId: string, productUrl: string) {
  const stale = await tx.order.findMany({
    where: {
      userId,
      status: "awaiting_payment",
      cartCheckout: true,
      items: { some: { productUrl } },
    },
    select: { id: true },
  });

  for (const { id } of stale) {
    const { count } = await tx.order.updateMany({
      where: { id, status: "awaiting_payment" },
      data: { status: "cancelled" },
    });
    if (count === 0) continue;
    await tx.orderEvent.create({
      data: {
        orderId: id,
        fromStatus: "awaiting_payment",
        toStatus: "cancelled",
        actor: `user:${userId}`,
        note: "آیتم از سبد خرید حذف شد؛ پرداخت‌نشده لغو شد.",
      },
    });
    await tx.payment.updateMany({ where: { orderId: id, status: "initiated" }, data: { status: "failed" } });
  }
}

export async function clearCart(userId: string) {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
}

/** مثل clearCart، اما در دل یک تراکنش موجود (تسویه‌ی سبد خرید یا تأیید پرداخت درگاهی سفارشِ سبد). */
export async function clearCartInTx(tx: Prisma.TransactionClient, userId: string) {
  const cart = await tx.cart.findUnique({ where: { userId } });
  if (!cart) return;
  await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
}
