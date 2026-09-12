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
