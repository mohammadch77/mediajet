// لغوِ سفارشِ پرداخت‌نشده (awaiting_payment). مشترک بین «انصراف کاربر از سفارش» و
// «حذف آیتم از سبد». سفارش حذف فیزیکی نمی‌شود (audit trail فقط‌افزودنی است): از مسیر
// state machine به cancelled می‌رود، رویداد ثبت می‌شود و از فهرست کاربر کنار می‌رود
// (app/api/orders GET).

import type { Prisma } from "@prisma/client";

/**
 * شرط status داخل updateMany لغو را با callback هم‌زمان درگاه اتمیک می‌کند:
 * سفارشی که همین لحظه پرداخت و queued شده، هرگز لغو نمی‌شود (برمی‌گرداند false).
 * تلاش پرداخت بازِ همان سفارش هم failed می‌شود تا callback دیرهنگام اثری نداشته باشد.
 */
export async function cancelUnpaidOrderInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  note: string,
): Promise<boolean> {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, userId, status: "awaiting_payment" },
    data: { status: "cancelled" },
  });
  if (count === 0) return false;

  await tx.orderEvent.create({
    data: {
      orderId,
      fromStatus: "awaiting_payment",
      toStatus: "cancelled",
      actor: `user:${userId}`,
      note,
    },
  });
  await tx.payment.updateMany({ where: { orderId, status: "initiated" }, data: { status: "failed" } });
  return true;
}
