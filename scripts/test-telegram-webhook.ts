// تست webhook تلگرام: شبیه‌سازی آپدیت‌های جعلی تلگرام به‌جای وبهوک واقعی (که نیاز به سرور عمومی دارد).
// سه مسیر بررسی می‌شود: فایل کوچک (ذخیره و دانلود در پنل کاربر)، فایل بزرگ (پیام پشتیبانی)،
// و امنیت (رد پیام از chat غیرمجاز یا بدون secret).
// نیازمند اجرای سرور dev (BASE_URL قابل تنظیم) با همان دیتابیس و همان پوشه‌ی کاری (storage/).
// چت اپراتور و secret وب‌هوک موقتاً در تنظیمات دیتابیس ست می‌شوند (withTelegramTestConfig).
// اگر توکن واقعی ربات تنظیم باشد، گام‌های وابسته به دانلود فایل از تلگرام skip می‌شوند.

import { prisma } from "../lib/db";
import { fileStorage } from "../lib/storage";
import {
  BASE_URL,
  check,
  skip,
  run,
  makeSessionCookie,
  randomMobile,
  readJson,
  withTelegramTestConfig,
  postWebhook,
} from "./testUtils";

const OPERATOR_CHAT_ID = "111111";
const NO_TOKEN_REASON = "توکن واقعی ربات تنظیم است؛ file_id جعلی از API تلگرام قابل دانلود نیست.";

function orderNotifyText(orderId: string): string {
  return `📦 سفارش جدید برای پردازش\nشماره سفارش: ${orderId}\nلینک محصول: https://example.com/p`;
}

type PanelItem = { status: string; downloadUrl: string | null; supportMessage: string | null };

run(() =>
  withTelegramTestConfig(OPERATOR_CHAT_ID, async (tg) => {
    const user = await prisma.user.create({
      data: { mobile: randomMobile("0935"), wallet: { create: { balanceRial: 5_000_000n } } },
    });
    const userCookie = await makeSessionCookie(user.id);

    const orderSmall = await prisma.order.create({
      data: {
        userId: user.id,
        totalPriceRial: 700000n,
        paymentMethod: "wallet",
        status: "queued",
        items: { create: { sourceSite: "Freepik", category: "vector", productUrl: "https://freepik.com/a", priceRial: 700000n } },
      },
    });
    const orderLarge = await prisma.order.create({
      data: {
        userId: user.id,
        totalPriceRial: 1200000n,
        paymentMethod: "wallet",
        status: "processing",
        items: { create: { sourceSite: "Envato", category: "video", productUrl: "https://envato.com/b", priceRial: 1200000n } },
      },
    });
    const smallMessage = {
      document: { file_id: "file-small-1", file_name: "design.zip", mime_type: "application/zip", file_size: 500_000 },
      reply_to_message: { text: orderNotifyText(orderSmall.id) },
    };

    // [۱] امنیت: پیام از چت غیرمجاز یا بدون secret باید بی‌اثر باشد
    console.log("[۱] امنیت وب‌هوک");
    const r1 = await postWebhook(tg, { message_id: 1, chat: { id: "999999" }, ...smallMessage });
    check("پیام از چت غیرمجاز → 200", r1.status === 200, r1.status);
    const r1b = await fetch(`${BASE_URL}/api/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { message_id: 2, chat: { id: OPERATOR_CHAT_ID }, ...smallMessage } }),
    });
    check("پیام بدون secret token → 200", r1b.status === 200, r1b.status);
    const afterUnauthorized = await prisma.order.findUnique({
      where: { id: orderSmall.id },
      include: { items: { include: { delivery: true } } },
    });
    check(
      "سفارش همچنان queued و بدون delivery",
      afterUnauthorized?.status === "queued" && !afterUnauthorized.items[0].delivery,
      afterUnauthorized?.status,
    );

    // [۲] فایل کوچک: اپراتور روی پیام سفارش reply می‌کند و فایل می‌فرستد
    console.log("[۲] تحویل فایل کوچک از تلگرام");
    const smallItemId = afterUnauthorized!.items[0].id;
    if (tg.hasRealBotToken) {
      skip("تحویل و دانلود فایل کوچک ([۲]، [۲.۱])", NO_TOKEN_REASON);
    } else {
      const r2 = await postWebhook(tg, { message_id: 3, chat: { id: OPERATOR_CHAT_ID }, ...smallMessage });
      check("وب‌هوک → 200", r2.status === 200, r2.status);
      const smallOrder = await prisma.order.findUnique({
        where: { id: orderSmall.id },
        include: { items: { include: { delivery: true } }, events: true },
      });
      check("سفارش کوچک ready شد", smallOrder?.status === "ready", smallOrder?.status);
      check("delivery با فایل روی دیسک ثبت شد", Boolean(smallOrder?.items[0].delivery?.storageKey), smallOrder?.items[0].delivery);
      check(
        "رویداد audit توسط اپراتور تلگرام",
        Boolean(smallOrder?.events.some((e) => e.toStatus === "ready" && e.actor === `operator:${OPERATOR_CHAT_ID}`)),
        smallOrder?.events.map((e) => `${e.fromStatus} → ${e.toStatus} (${e.actor})`),
      );

      // [۲.۱] دانلود از پنل کاربر (endpoint محافظت‌شده، بر اساس orderItemId)
      const rDownload = await fetch(`${BASE_URL}/api/orders/items/${smallItemId}/download`, { headers: { Cookie: userCookie } });
      const downloadBody = await rDownload.text();
      check("[۲.۱] دانلود توسط مالک → 200", rDownload.status === 200, rDownload.status);
      check("[۲.۱] محتوای فایل شبیه‌سازی‌شده", downloadBody.startsWith("simulated-file-content:file-small-1"), downloadBody.slice(0, 80));
    }

    // [۲.۲] کاربر دیگر نباید بتواند فایل را دانلود کند
    const otherUser = await prisma.user.create({ data: { mobile: randomMobile("0936"), wallet: { create: { balanceRial: 0n } } } });
    const otherCookie = await makeSessionCookie(otherUser.id);
    const rDownloadOther = await fetch(`${BASE_URL}/api/orders/items/${smallItemId}/download`, { headers: { Cookie: otherCookie } });
    check("[۲.۲] دانلود توسط غیرمالک → 404", rDownloadOther.status === 404, rDownloadOther.status);

    // [۳] فایل بزرگ: اپراتور با دستور «/large» پاسخ می‌دهد (بدون فایل)
    console.log("[۳] علامت‌گذاری فایل بزرگ");
    const r3 = await postWebhook(tg, {
      message_id: 4,
      chat: { id: OPERATOR_CHAT_ID },
      text: "/large",
      reply_to_message: { text: orderNotifyText(orderLarge.id) },
    });
    check("وب‌هوک → 200", r3.status === 200, r3.status);
    const largeOrder = await prisma.order.findUnique({
      where: { id: orderLarge.id },
      include: { items: { include: { delivery: true } } },
    });
    check(
      "سفارش بزرگ ready با isLarge",
      largeOrder?.status === "ready" && largeOrder.items[0].delivery?.isLarge === true,
      { status: largeOrder?.status, isLarge: largeOrder?.items[0].delivery?.isLarge },
    );

    // [۳.۱] در پنل کاربر باید پیام پشتیبانی نمایش داده شود، نه لینک دانلود
    const rOrders = await fetch(`${BASE_URL}/api/orders`, { headers: { Cookie: userCookie } });
    const ordersData = await readJson(rOrders);
    const largeInPanel = ordersData?.orders?.find((o: { id: string }) => o.id === orderLarge.id);
    const largePanelItem: PanelItem | undefined = largeInPanel?.items?.[0];
    check(
      "[۳.۱] آیتم بزرگ در پنل: پیام پشتیبانی بدون لینک دانلود",
      Boolean(largePanelItem?.supportMessage) && !largePanelItem?.downloadUrl,
      largePanelItem,
    );

    // [۴] سفارش چندآیتمی: یک آیتم آماده (با دانلود جدا)، یک آیتم بزرگ (پیام پشتیبانی)، یک آیتم در انتظار
    console.log("[۴] سفارش چندآیتمی در پنل");
    const orderMulti = await prisma.order.create({
      data: {
        userId: user.id,
        totalPriceRial: 3_000_000n,
        paymentMethod: "wallet",
        status: "processing",
        items: {
          create: [
            { sourceSite: "Freepik", category: "vector", productUrl: "https://freepik.com/multi-ready", priceRial: 1_000_000n, status: "ready" },
            { position: 1, sourceSite: "Envato", category: "video", productUrl: "https://envato.com/multi-large", priceRial: 1_500_000n, status: "ready" },
            { position: 2, sourceSite: "Shutterstock", category: "photo", productUrl: "https://shutterstock.com/multi-pending", priceRial: 500_000n, status: "pending" },
          ],
        },
      },
      include: { items: { orderBy: { position: "asc" } } },
    });
    const [multiReadyItem, multiLargeItem] = orderMulti.items;
    // فایل واقعاً روی دیسک نوشته می‌شود؛ وگرنه endpoint دانلود (به‌درستی) ۴۰۴ «فایل روی سرور یافت نشد» می‌دهد.
    const readyKey = `test/${multiReadyItem.id}.zip`;
    await fileStorage.save(readyKey, Buffer.from("multi-ready-content"));
    await prisma.delivery.create({
      data: {
        orderItemId: multiReadyItem.id,
        storageKey: readyKey,
        fileName: "ready-item.zip",
        mimeType: "application/zip",
        fileSizeBytes: 19,
        isLarge: false,
        isOnDisk: true,
      },
    });
    await prisma.delivery.create({ data: { orderItemId: multiLargeItem.id, isLarge: true, isOnDisk: false } });

    const multiOrdersData = await readJson(await fetch(`${BASE_URL}/api/orders`, { headers: { Cookie: userCookie } }));
    const multiItems: PanelItem[] =
      multiOrdersData?.orders?.find((o: { id: string }) => o.id === orderMulti.id)?.items ?? [];
    check(
      "۳ آیتم با وضعیت/دانلود جدا",
      multiItems.length === 3 &&
        multiItems[0].status === "ready" && Boolean(multiItems[0].downloadUrl) &&
        multiItems[1].status === "ready" && !multiItems[1].downloadUrl && Boolean(multiItems[1].supportMessage) &&
        multiItems[2].status === "pending" && !multiItems[2].downloadUrl,
      multiItems,
    );

    // [۴.۱] دانلود آیتم آماده‌ی سفارش چندآیتمی به‌صورت مستقل (بر اساس orderItemId خودش)
    const rMultiDownload = await fetch(`${BASE_URL}/api/orders/items/${multiReadyItem.id}/download`, { headers: { Cookie: userCookie } });
    const multiBody = await rMultiDownload.text();
    check("[۴.۱] دانلود آیتم آماده → 200 با محتوای درست", rMultiDownload.status === 200 && multiBody === "multi-ready-content", rMultiDownload.status);

    // [۴.۲] آیتم بزرگ نباید مستقیماً دانلود شود
    const rMultiLargeDownload = await fetch(`${BASE_URL}/api/orders/items/${multiLargeItem.id}/download`, { headers: { Cookie: userCookie } });
    check("[۴.۲] دانلود آیتم بزرگ → 404", rMultiLargeDownload.status === 404, rMultiLargeDownload.status);

    await fileStorage.delete(readyKey);
  }),
);
