// State machine وضعیت سفارش. هیچ تغییر وضعیتی خارج از این گراف مجاز نیست.
// طبق استاندارد ارشامان: انتقال نامعتبر باید رد شود، نه اینکه بی‌سروصدا انجام گیرد.

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "queued"
  | "processing"
  | "ready"
  | "delivered"
  | "cancelled"
  | "failed"
  | "refunded";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["queued", "cancelled"],
  queued: ["processing", "cancelled"],
  processing: ["ready", "failed"],
  ready: ["delivered", "failed"],
  delivered: [],
  cancelled: [],
  failed: ["refunded", "queued"], // امکان تلاش مجدد یا بازگشت وجه
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** انتقال امن؛ در صورت نامعتبر بودن، خطا پرتاب می‌کند. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`انتقال نامعتبر وضعیت سفارش: ${from} → ${to}`);
  }
}

/**
 * مسیر بازگشت وجه برای هر وضعیتِ پرداخت‌شده‌ی قابل بازگشت (هر گام همچنان با assertTransition چک می‌شود).
 * سفارش پرداخت‌نشده یا تحویل‌شده (delivered) بازگشت وجه ندارد.
 */
export const REFUND_PATHS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  queued: ["cancelled"],
  processing: ["failed", "refunded"],
  ready: ["failed", "refunded"],
  failed: ["refunded"],
};

/** وضعیت‌هایی که پول جابه‌جا می‌کنند؛ فقط از مسیر بازگشت وجه ادمین (lib/refund.ts)، نه تغییر وضعیت اپراتور. */
export const ADMIN_ONLY_STATUSES: OrderStatus[] = ["cancelled", "refunded"];

/** انتقال مجاز برای اپراتور: همان state machine، منهای وضعیت‌های مالیِ مخصوص ادمین. */
export function operatorCanTransition(from: OrderStatus, to: OrderStatus): boolean {
  return canTransition(from, to) && !ADMIN_ONLY_STATUSES.includes(to);
}

export function isRefundable(status: OrderStatus): boolean {
  return status in REFUND_PATHS;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "پیش‌نویس",
  awaiting_payment: "در انتظار پرداخت",
  queued: "در صف پردازش",
  processing: "در حال پردازش",
  ready: "آماده‌ی دانلود",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
  failed: "ناموفق",
  refunded: "بازگشت وجه",
};

// وضعیت تحویل یک آیتم سفارش؛ مستقل از وضعیت کلی سفارش (lib/orderState.ts#OrderStatus)
// و مستقل از بقیه‌ی آیتم‌های همان سفارش.
export type OrderItemStatus = "pending" | "ready" | "delivered";

export const ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  pending: "در حال پردازش",
  ready: "آماده‌ی دانلود",
  delivered: "تحویل‌شده",
};

/**
 * وضعیت کلی سفارش را از وضعیت آیتم‌هایش مشتق می‌کند — فقط برای سفارش‌هایی که وارد صف
 * پردازش شده‌اند (queued/processing/ready/delivered). draft/awaiting_payment/cancelled/
 * failed/refunded با ماشین وضعیت سفارش (نه آیتم‌ها) کنترل می‌شوند و این تابع روی آن‌ها
 * فراخوانی نمی‌شود.
 *
 * قانون: همه‌ی آیتم‌ها delivered → سفارش delivered.
 *        حداقل یک آیتم ready یا delivered → سفارش ready (بقیه هنوز در حال پردازش‌اند).
 *        در غیر این صورت (همه pending) → سفارش processing.
 */
export function deriveOrderStatusFromItems(
  itemStatuses: OrderItemStatus[],
): "processing" | "ready" | "delivered" {
  if (itemStatuses.length === 0) {
    throw new Error("سفارش بدون آیتم نمی‌تواند وضعیت داشته باشد.");
  }
  if (itemStatuses.every((s) => s === "delivered")) {
    return "delivered";
  }
  if (itemStatuses.some((s) => s === "ready" || s === "delivered")) {
    return "ready";
  }
  return "processing";
}
