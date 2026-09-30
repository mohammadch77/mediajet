// منطق مشترک تحویل آیتم سفارش — استفاده‌شده هم در پنل اپراتور (وب) و هم در وب‌هوک تلگرام،
// تا سقف حجم فایل و منطق پیشروی وضعیت سفارش در یک‌جا تعریف شود (نه تکراری در دو مسیر).

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { onOrderStatusChangedInTx } from "./affiliate";
import { assertTransition, deriveOrderStatusFromItems, type OrderStatus, type OrderItemStatus } from "./orderState";
import { createNotification, createSupportReply, NOTIFICATION_HREF } from "./notifications";
import { formatOrderNumber } from "./orderNumber";

/** سقف حجم فایل برای هر آیتم (نه کل سفارش) — چه از طریق پنل وب و چه بات تلگرام. */
export const MAX_ITEM_FILE_BYTES = 20 * 1024 * 1024;

/** وضعیت‌های سفارش که تحویل یک آیتم در آن‌ها معنا دارد (سفارش وارد صف پردازش شده و هنوز delivered/cancelled/failed/refunded نیست). */
export const DELIVERABLE_ORDER_STATUSES: OrderStatus[] = ["queued", "processing", "ready"];

export class DeliveryTargetError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DeliveryTargetError";
  }
}

/**
 * سفارش و آیتم مقصد را بارگذاری و اعتبارسنجی می‌کند: سفارش/آیتم باید وجود داشته باشند و
 * سفارش باید بتواند به ready برود (state machine). استفاده‌شده در هر سه endpoint تحویل
 * آیتم (لینک/آپلود/بزرگ در پنل اپراتور) تا این چک تکرار نشود.
 */
export async function loadDeliverableItem(orderId: string, orderItemId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) {
    throw new DeliveryTargetError("سفارش یافت نشد.", 404);
  }
  const item = order.items.find((i) => i.id === orderItemId);
  if (!item) {
    throw new DeliveryTargetError("آیتم سفارش یافت نشد.", 404);
  }

  const fromStatus = order.status as OrderStatus;
  if (!DELIVERABLE_ORDER_STATUSES.includes(fromStatus)) {
    throw new DeliveryTargetError(`در وضعیت «${fromStatus}» تحویل آیتم ممکن نیست.`, 422);
  }

  return { order, item, fromStatus };
}

const ORDER_SEQUENCE: OrderStatus[] = ["queued", "processing", "ready", "delivered"];

/**
 * وضعیت سفارش را بر اساس وضعیت فعلی همه‌ی آیتم‌هایش (deriveOrderStatusFromItems) به جلو می‌برد.
 * هر گام از state machine سفارش را با assertTransition چک و یک OrderEvent برایش ثبت می‌کند —
 * دقیقاً مثل قبل (advanceToReady در وب‌هوک تلگرام) ولی حالا برای N آیتم به‌جای یک آیتم ثابت.
 * اگر سفارش هنوز در draft/awaiting_payment باشد یا از قبل به وضعیت مشتق‌شده رسیده/جلوتر باشد، بی‌اثر است.
 */
export async function advanceOrderStatusFromItems(
  tx: Prisma.TransactionClient,
  orderId: string,
  fromStatus: OrderStatus,
  actor: string,
  note: string,
): Promise<void> {
  const currentIndex = ORDER_SEQUENCE.indexOf(fromStatus);
  if (currentIndex === -1) {
    // draft/awaiting_payment/cancelled/failed/refunded — این تابع روی این‌ها اعمال نمی‌شود.
    return;
  }

  const items = await tx.orderItem.findMany({ where: { orderId }, select: { status: true } });
  const target = deriveOrderStatusFromItems(items.map((i) => i.status as OrderItemStatus));
  const targetIndex = ORDER_SEQUENCE.indexOf(target);

  let current = fromStatus;
  for (let i = currentIndex + 1; i <= targetIndex; i++) {
    const next = ORDER_SEQUENCE[i];
    assertTransition(current, next);
    await tx.order.update({ where: { id: orderId }, data: { status: next } });
    await tx.orderEvent.create({
      data: { orderId, fromStatus: current, toStatus: next, actor, note },
    });
    await onOrderStatusChangedInTx(tx, orderId, next);
    current = next;
  }
}

/** راهنمای دریافت فایل بزرگ؛ یکسان در صفحه‌ی سفارش‌ها و صندوق پیام. کاربر فقط از صندوق پیام سایت با پشتیبانی حرف می‌زند. */
export const LARGE_FILE_USER_HINT = "فایل شما آماده است. برای دریافت آن، لطفاً از بخش «پیام‌ها» در پنل خود به پشتیبانی پیام دهید.";

type MarkReadyParams = {
  orderId: string;
  orderItemId: string;
  fromOrderStatus: OrderStatus;
  actor: string;
  note: string;
};

/**
 * آیتم را به‌عنوان تحویل‌شده (ready) علامت می‌زند، وضعیت سفارش را متناسب با همه‌ی آیتم‌ها جلو می‌برد
 * و به کاربر اعلان «فایل آماده است» می‌دهد.
 */
export async function markItemReadyAndAdvanceOrder(tx: Prisma.TransactionClient, params: MarkReadyParams): Promise<void> {
  const order = await markItemReady(tx, params);
  await createNotification(tx, {
    userId: order.userId,
    text: `فایل سفارش ${formatOrderNumber(order.orderNumber)} آماده‌ی دانلود است.`,
    href: NOTIFICATION_HREF.orders,
  });
}

async function markItemReady(tx: Prisma.TransactionClient, params: MarkReadyParams) {
  const { orderId, orderItemId, fromOrderStatus, actor, note } = params;
  await tx.orderItem.update({ where: { id: orderItemId }, data: { status: "ready" } });
  await advanceOrderStatusFromItems(tx, orderId, fromOrderStatus, actor, note);
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true, orderNumber: true } });
}

/**
 * آیتم را «فایل بزرگ» علامت می‌زند، آن را ready می‌کند و یک پیام در صندوق پشتیبانی کاربر
 * می‌گذارد تا کاربر بداند برای دریافت فایل باید همان‌جا پیام بدهد.
 * علامت‌گذاری تکراری همان آیتم پیام تکراری نمی‌سازد.
 */
export async function markItemLargeAndNotifyUser(
  tx: Prisma.TransactionClient,
  params: MarkReadyParams & { itemLabel: string },
): Promise<void> {
  const { orderItemId, itemLabel } = params;

  const existing = await tx.delivery.findUnique({ where: { orderItemId }, select: { isLarge: true } });
  await tx.delivery.upsert({
    where: { orderItemId },
    create: { orderItemId, isLarge: true },
    update: { isLarge: true, fileUrl: null, storageKey: null, isOnDisk: false, deliveredAt: new Date() },
  });
  const order = await markItemReady(tx, params);

  if (!existing?.isLarge) {
    await createSupportReply(tx, {
      userId: order.userId,
      text: `سفارش ${formatOrderNumber(order.orderNumber)} (آیتم ${itemLabel}): حجم فایل بیش از ۲۰ مگابایت است و از صفحه‌ی سفارش‌ها قابل دانلود نیست. ${LARGE_FILE_USER_HINT}`,
    });
  }
}
