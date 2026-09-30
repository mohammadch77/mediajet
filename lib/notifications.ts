// اعلان‌های کاربر (زنگوله‌ی هدر) و پیام‌های سیستمی پشتیبانی — یک‌جا تا متن/لینک در همه‌ی مسیرها یکسان باشد.

import { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;

export const NOTIFICATION_HREF = {
  orders: "/dashboard?tab=orders",
  messages: "/dashboard?tab=messages",
  affiliate: "/affiliate",
} as const;

export async function createNotification(
  db: Db,
  params: { userId: string; text: string; href: string },
): Promise<void> {
  await db.notification.create({ data: params });
}

/** پیام پشتیبانی برای کاربر ثبت می‌کند و برایش اعلان می‌سازد. */
export async function createSupportReply(db: Db, params: { userId: string; text: string }): Promise<void> {
  await db.supportMessage.create({
    data: { userId: params.userId, sender: "support", text: params.text, readByUser: false },
  });
  await createNotification(db, {
    userId: params.userId,
    text: "پیام جدید از پشتیبانی دارید.",
    href: NOTIFICATION_HREF.messages,
  });
}
