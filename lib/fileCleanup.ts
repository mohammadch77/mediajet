// پاک‌سازی دوره‌ای فایل‌های کوچک از دیسک: فقط فایل فیزیکی حذف می‌شود، رکورد Delivery
// و telegramFileId (برای بازیابی بعدی از تلگرام) باقی می‌مانند. این کار فضای دیسک را
// آزاد نگه می‌دارد بدون آنکه امکان دانلود فایل برای کاربر از بین برود.

import type { Delivery } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { downloadTelegramFile } from "@/lib/telegram";

const RETENTION_MS = 24 * 60 * 60 * 1000; // ۲۴ ساعت از آخرین دسترسی

/**
 * فایل‌های کوچکِ روی دیسک را که بیش از ۲۴ ساعت از آخرین دسترسی‌شان گذشته پاک می‌کند.
 * فقط تحویل‌های isLarge=false و isOnDisk=true و دارای telegramFileId (قابل‌بازیابی) بررسی می‌شوند.
 */
export async function cleanupStaleFiles(): Promise<{ deletedCount: number; deletedOrderIds: string[] }> {
  const cutoff = new Date(Date.now() - RETENTION_MS);

  const staleDeliveries = await prisma.delivery.findMany({
    where: {
      isLarge: false,
      isOnDisk: true,
      storageKey: { not: null },
      telegramFileId: { not: null },
      lastAccessedAt: { lt: cutoff },
    },
  });

  const deletedOrderIds: string[] = [];

  for (const delivery of staleDeliveries) {
    if (!delivery.storageKey) continue;
    try {
      await fileStorage.delete(delivery.storageKey);
      await prisma.delivery.update({
        where: { id: delivery.id },
        data: { isOnDisk: false },
      });
      deletedOrderIds.push(delivery.orderId);
    } catch (error) {
      console.error(`[پاک‌سازی فایل خطا] حذف فایل تحویل ${delivery.id} با خطا مواجه شد:`, error);
    }
  }

  return { deletedCount: deletedOrderIds.length, deletedOrderIds };
}

/**
 * تضمین می‌کند فایل تحویل روی دیسک موجود است؛ در صورت پاک‌شدن، آن را دوباره از تلگرام
 * (با telegramFileId) دانلود و ذخیره می‌کند و lastAccessedAt/isOnDisk را به‌روز می‌کند.
 * اگر فایل از قبل روی دیسک باشد، فقط lastAccessedAt به‌روز می‌شود.
 */
export async function ensureFileOnDisk(delivery: Delivery): Promise<void> {
  if (!delivery.storageKey) {
    throw new Error("این تحویل فایل قابل‌دانلود ندارد.");
  }

  if (delivery.isOnDisk) {
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { lastAccessedAt: new Date() },
    });
    return;
  }

  if (!delivery.telegramFileId) {
    throw new Error("فایل روی دیسک نیست و امکان بازیابی از تلگرام وجود ندارد.");
  }

  const buffer = await downloadTelegramFile(delivery.telegramFileId, delivery.fileName ?? undefined);
  await fileStorage.save(delivery.storageKey, buffer);
  await prisma.delivery.update({
    where: { id: delivery.id },
    data: { isOnDisk: true, lastAccessedAt: new Date() },
  });
}
