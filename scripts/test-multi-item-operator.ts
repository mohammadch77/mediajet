// تست پنل اپراتور و تلگرام چندآیتمی (قدم ۵ سبد خرید):
// [۱] پنل وب: تحویل مستقل هر آیتم (لینک) از یک سفارش چندآیتمی + علامت‌گذاری یک آیتم به‌عنوان بزرگ.
// [۲] سفارش وقتی همه‌ی آیتم‌ها رسیدگی شدند به وضعیت نهایی (ready) می‌رود.
// [۳] تلگرام: تشخیص درست آیتم از روی «آیتم N» در reply + محدودیت ۲۰ مگابایت per-item.
// نیازمند اجرای سرور dev (BASE_URL قابل تنظیم). چت اپراتور و secret وب‌هوک موقتاً در تنظیمات
// دیتابیس ست می‌شوند (withTelegramTestConfig)؛ با توکن واقعی ربات، تحویل فایل از تلگرام skip می‌شود.

import { prisma } from "../lib/db";
import {
  BASE_URL,
  check,
  skip,
  run,
  makeSessionCookie,
  randomMobile,
  withTelegramTestConfig,
  postWebhook,
} from "./testUtils";

const OPERATOR_CHAT_ID = "333333";

function orderNotifyText(orderId: string): string {
  return `📦 سفارش جدید برای پردازش\nشماره سفارش: ${orderId}\n1. https://a\n2. https://b`;
}

function loadOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: { items: { include: { delivery: true }, orderBy: { createdAt: "asc" } }, events: true },
  });
}

run(() =>
  withTelegramTestConfig(OPERATOR_CHAT_ID, async (tg) => {
    const operator = await prisma.user.create({
      data: { mobile: randomMobile("0937"), role: "operator", wallet: { create: { balanceRial: 0n } } },
    });
    const operatorCookie = await makeSessionCookie(operator.id);
    const regularUser = await prisma.user.create({ data: { mobile: randomMobile("0938"), wallet: { create: { balanceRial: 0n } } } });
    const regularCookie = await makeSessionCookie(regularUser.id);
    const buyer = await prisma.user.create({ data: { mobile: randomMobile("0939"), wallet: { create: { balanceRial: 5_000_000n } } } });

    // === [۱] سفارش چندآیتمی برای پنل وب ===
    console.log("[۱] پنل وب اپراتور");
    const orderWeb = await prisma.order.create({
      data: {
        userId: buyer.id,
        totalPriceRial: 2_500_000n,
        paymentMethod: "wallet",
        status: "queued",
        items: {
          create: [
            { sourceSite: "Freepik", category: "vector", productUrl: "https://freepik.com/web-1", priceRial: 1_000_000n },
            { sourceSite: "Envato", category: "video", productUrl: "https://envato.com/web-2", priceRial: 1_500_000n },
          ],
        },
      },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    const [webItem1, webItem2] = orderWeb.items;
    const itemUrl = (itemId: string, action: string) => `${BASE_URL}/api/operator/orders/${orderWeb.id}/items/${itemId}/${action}`;

    const rForbiddenList = await fetch(`${BASE_URL}/api/operator/orders`, { headers: { Cookie: regularCookie } });
    check("[۱.۱] لیست سفارش‌های اپراتور با کاربر عادی → 403", rForbiddenList.status === 403, rForbiddenList.status);

    const rForbiddenDeliver = await fetch(itemUrl(webItem1.id, "deliver"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: regularCookie },
      body: JSON.stringify({ fileUrl: "https://cdn.example.com/hack.zip" }),
    });
    check("[۱.۲] تحویل آیتم با کاربر عادی → 403", rForbiddenDeliver.status === 403, rForbiddenDeliver.status);

    const rDeliverItem1 = await fetch(itemUrl(webItem1.id, "deliver"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: operatorCookie },
      body: JSON.stringify({ fileUrl: "https://cdn.example.com/item1.zip" }),
    });
    check("[۱.۳] تحویل آیتم ۱ با لینک → 200", rDeliverItem1.status === 200, rDeliverItem1.status);
    const afterItem1 = await loadOrder(orderWeb.id);
    check(
      "[۱.۳] آیتم ۱ ready، آیتم ۲ pending (سفارش طبق deriveOrderStatusFromItems → ready)",
      afterItem1?.status === "ready" && afterItem1.items[0].status === "ready" && afterItem1.items[1].status === "pending",
      { order: afterItem1?.status, items: afterItem1?.items.map((i) => i.status) },
    );

    const rLargeItem2 = await fetch(itemUrl(webItem2.id, "large"), { method: "POST", headers: { Cookie: operatorCookie } });
    check("[۱.۴] علامت‌گذاری آیتم ۲ به‌عنوان فایل بزرگ → 200", rLargeItem2.status === 200, rLargeItem2.status);

    // === [۲] وضعیت نهایی سفارش وقتی همه‌ی آیتم‌ها رسیدگی شدند ===
    const finalOrder = await loadOrder(orderWeb.id);
    check(
      "[۲] سفارش ready و هر دو آیتم ready (آیتم ۲ isLarge)",
      finalOrder?.status === "ready" &&
        finalOrder.items.every((i) => i.status === "ready") &&
        finalOrder.items[1].delivery?.isLarge === true,
      finalOrder?.items.map((i) => ({ status: i.status, isLarge: i.delivery?.isLarge })),
    );
    check(
      "[۲] رویدادهای audit: queued → processing → ready توسط اپراتور",
      ["processing", "ready"].every((s) => finalOrder?.events.some((e) => e.toStatus === s && e.actor === `operator:${operator.id}`)),
      finalOrder?.events.map((e) => `${e.fromStatus} → ${e.toStatus} (${e.actor})`),
    );

    // === [۳] سفارش چندآیتمی برای تلگرام ===
    console.log("[۳] تحویل چندآیتمی از تلگرام");
    const orderTg = await prisma.order.create({
      data: {
        userId: buyer.id,
        totalPriceRial: 2_000_000n,
        paymentMethod: "wallet",
        status: "queued",
        items: {
          create: [
            { sourceSite: "Freepik", category: "vector", productUrl: "https://freepik.com/tg-1", priceRial: 800_000n },
            { sourceSite: "Shutterstock", category: "photo", productUrl: "https://shutterstock.com/tg-2", priceRial: 1_200_000n },
          ],
        },
      },
    });
    const replyTo = { text: orderNotifyText(orderTg.id) };
    const doc = (file_id: string, file_size: number) => ({ file_id, file_name: `${file_id}.zip`, mime_type: "application/zip", file_size });

    // [۳.۱] reply بدون شماره‌ی آیتم باید بی‌اثر باشد (نه تحویل اشتباه آیتم ۱)
    const rNoIndex = await postWebhook(tg, { message_id: 10, chat: { id: OPERATOR_CHAT_ID }, document: doc("ambiguous", 1000), reply_to_message: replyTo });
    const afterNoIndex = await loadOrder(orderTg.id);
    check(
      "[۳.۱] reply بدون شماره‌ی آیتم → 200 و هر دو آیتم pending",
      rNoIndex.status === 200 && afterNoIndex!.items.every((i) => i.status === "pending"),
      afterNoIndex?.items.map((i) => i.status),
    );

    // [۳.۲] reply با «آیتم 2» باید دقیقاً آیتم دوم را تحویل بدهد، نه اولی
    let item2DeliveredByFile = false;
    if (tg.hasRealBotToken) {
      skip("[۳.۲] تحویل فایل آیتم ۲ از تلگرام", "توکن واقعی ربات تنظیم است؛ file_id جعلی قابل دانلود نیست.");
    } else {
      const rItem2 = await postWebhook(tg, { message_id: 11, chat: { id: OPERATOR_CHAT_ID }, caption: "آیتم 2", document: doc("item2", 500_000), reply_to_message: replyTo });
      const afterItem2 = await loadOrder(orderTg.id);
      check(
        "[۳.۲] «آیتم 2» → آیتم ۱ pending، آیتم ۲ ready با فایل",
        rItem2.status === 200 &&
          afterItem2?.items[0].status === "pending" &&
          afterItem2.items[1].status === "ready" &&
          Boolean(afterItem2.items[1].delivery?.storageKey),
        afterItem2?.items.map((i) => ({ status: i.status, hasFile: Boolean(i.delivery?.storageKey) })),
      );
      item2DeliveredByFile = true;
    }

    // [۳.۳] فایل بیش از ۲۰ مگابایت برای آیتم ۱: دانلود نمی‌شود و خودکار «فایل بزرگ» ثبت می‌شود
    const rTooLarge = await postWebhook(tg, {
      message_id: 12,
      chat: { id: OPERATOR_CHAT_ID },
      caption: "آیتم 1",
      document: doc("huge", 21 * 1024 * 1024),
      reply_to_message: replyTo,
    });
    const afterTooLarge = await loadOrder(orderTg.id);
    check(
      "[۳.۳] فایل ۲۱ مگابایتی آیتم ۱ → isLarge بدون فایل روی دیسک",
      rTooLarge.status === 200 &&
        afterTooLarge?.items[0].status === "ready" &&
        afterTooLarge.items[0].delivery?.isLarge === true &&
        !afterTooLarge.items[0].delivery?.storageKey,
      afterTooLarge?.items[0].delivery,
    );

    // [۳.۴] «آیتم 2 بزرگ» بدون فایل هم باید آیتم را بزرگ ثبت کند (وقتی تحویل فایل skip شده، آیتم ۲ را همین‌جا تکمیل می‌کند)
    if (!item2DeliveredByFile) {
      const rLargeTg = await postWebhook(tg, { message_id: 13, chat: { id: OPERATOR_CHAT_ID }, text: "آیتم 2 بزرگ", reply_to_message: replyTo });
      check("[۳.۴] «آیتم 2 بزرگ» → 200", rLargeTg.status === 200, rLargeTg.status);
    }

    const finalTgOrder = await loadOrder(orderTg.id);
    check(
      "[۳.۵] سفارش تلگرام ready و هر دو آیتم ready",
      finalTgOrder?.status === "ready" && finalTgOrder.items.every((i) => i.status === "ready"),
      { order: finalTgOrder?.status, items: finalTgOrder?.items.map((i) => ({ status: i.status, isLarge: i.delivery?.isLarge })) },
    );
  }),
);
