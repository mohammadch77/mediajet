// تست پنل اپراتور و تلگرام چندآیتمی (قدم ۵ سبد خرید):
// [۱] پنل وب: تحویل مستقل هر آیتم (لینک) از یک سفارش چندآیتمی + علامت‌گذاری یک آیتم به‌عنوان بزرگ.
// [۲] سفارش وقتی همه‌ی آیتم‌ها رسیدگی شدند به وضعیت نهایی (ready) می‌رود.
// [۳] کاربر عادی روی endpointهای اپراتور باید ۴۰۳ بگیرد.
// [۴] تلگرام: تشخیص درست آیتم از روی «آیتم N» در reply، برای سفارش چندآیتمی دیگر.
// [۵] محدودیت ۲۰ مگابایت per-item از طریق تلگرام.
// نیازمند اجرای سرور dev (BASE_URL قابل تنظیم).

import crypto from "crypto";
import { prisma } from "../lib/db";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "mediajet_session";
const OPERATOR_CHAT_ID = process.env.TELEGRAM_CHAT_OPERATOR || "333333";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function makeSessionCookie(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) },
  });
  return `${SESSION_COOKIE}=${token}`;
}

function orderNotifyText(orderId: string): string {
  return `📦 سفارش جدید برای پردازش\nشماره سفارش: ${orderId}\n1. https://a\n2. https://b`;
}

async function main() {
  const operatorMobile = "0937" + Math.floor(1000000 + Math.random() * 8999999);
  const operator = await prisma.user.create({
    data: { mobile: operatorMobile, role: "operator", wallet: { create: { balanceRial: 0n } } },
  });
  const operatorCookie = await makeSessionCookie(operator.id);

  const regularMobile = "0938" + Math.floor(1000000 + Math.random() * 8999999);
  const regularUser = await prisma.user.create({
    data: { mobile: regularMobile, wallet: { create: { balanceRial: 0n } } },
  });
  const regularCookie = await makeSessionCookie(regularUser.id);

  const buyerMobile = "0939" + Math.floor(1000000 + Math.random() * 8999999);
  const buyer = await prisma.user.create({
    data: { mobile: buyerMobile, wallet: { create: { balanceRial: 5_000_000n } } },
  });

  // === [۱] سفارش چندآیتمی برای پنل وب ===
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
  console.log("[۱] سفارش چندآیتمی ساخته شد:", orderWeb.id, "آیتم‌ها:", webItem1.id, webItem2.id);

  // [۱.۱] کاربر عادی باید روی لیست سفارش‌های اپراتور ۴۰۳ بگیرد
  const rForbiddenList = await fetch(`${BASE_URL}/api/operator/orders`, { headers: { Cookie: regularCookie } });
  console.log("[۱.۱] لیست سفارش‌ها با کاربر عادی (انتظار 403):", rForbiddenList.status);

  // [۱.۲] کاربر عادی باید روی تحویل آیتم هم ۴۰۳ بگیرد
  const rForbiddenDeliver = await fetch(`${BASE_URL}/api/operator/orders/${orderWeb.id}/items/${webItem1.id}/deliver`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: regularCookie },
    body: JSON.stringify({ fileUrl: "https://cdn.example.com/hack.zip" }),
  });
  console.log("[۱.۲] تحویل آیتم با کاربر عادی (انتظار 403):", rForbiddenDeliver.status);

  // [۱.۳] اپراتور آیتم ۱ را با لینک تحویل می‌دهد
  const rDeliverItem1 = await fetch(`${BASE_URL}/api/operator/orders/${orderWeb.id}/items/${webItem1.id}/deliver`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: operatorCookie },
    body: JSON.stringify({ fileUrl: "https://cdn.example.com/item1.zip" }),
  });
  console.log("[۱.۳] تحویل آیتم ۱ با لینک:", rDeliverItem1.status, await rDeliverItem1.json());

  const afterItem1 = await prisma.order.findUnique({
    where: { id: orderWeb.id },
    include: { items: { include: { delivery: true }, orderBy: { createdAt: "asc" } } },
  });
  console.log(
    "    وضعیت سفارش بعد از تحویل آیتم ۱ (انتظار ready چون حداقل یک آیتم ready است، طبق deriveOrderStatusFromItems):",
    afterItem1?.status,
    "| آیتم ۱:",
    afterItem1?.items[0].status,
    "| آیتم ۲:",
    afterItem1?.items[1].status,
  );

  // [۱.۴] اپراتور آیتم ۲ را «فایل بزرگ» علامت می‌زند
  const rLargeItem2 = await fetch(`${BASE_URL}/api/operator/orders/${orderWeb.id}/items/${webItem2.id}/large`, {
    method: "POST",
    headers: { Cookie: operatorCookie },
  });
  console.log("[۱.۴] علامت‌گذاری آیتم ۲ به‌عنوان فایل بزرگ:", rLargeItem2.status, await rLargeItem2.json());

  // === [۲] وضعیت نهایی سفارش وقتی همه‌ی آیتم‌ها رسیدگی شدند ===
  const finalOrder = await prisma.order.findUnique({
    where: { id: orderWeb.id },
    include: { items: { include: { delivery: true }, orderBy: { createdAt: "asc" } }, events: true },
  });
  console.log(
    "[۲] وضعیت نهایی سفارش (انتظار ready چون همه‌ی آیتم‌ها ready/delivered‌اند):",
    finalOrder?.status,
    "| آیتم‌ها:",
    finalOrder?.items.map((i) => ({ status: i.status, isLarge: i.delivery?.isLarge })),
  );
  console.log(
    "    رویدادهای audit:",
    finalOrder?.events.map((e) => `${e.fromStatus} → ${e.toStatus} (${e.actor})`),
  );

  // === [۳] سفارش چندآیتمی برای تلگرام ===
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
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  const [tgItem1, tgItem2] = orderTg.items;
  console.log("[۳] سفارش چندآیتمی برای تلگرام:", orderTg.id, "آیتم‌ها:", tgItem1.id, tgItem2.id);

  // [۳.۱] reply بدون شماره‌ی آیتم باید بی‌اثر باشد و راهنما بفرستد (نه تحویل اشتباه آیتم ۱)
  const rNoIndex = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 10,
        chat: { id: OPERATOR_CHAT_ID },
        document: { file_id: "no-index-file", file_name: "ambiguous.zip", mime_type: "application/zip", file_size: 1000 },
        reply_to_message: { text: orderNotifyText(orderTg.id) },
      },
    }),
  });
  console.log("[۳.۱] reply بدون شماره‌ی آیتم (انتظار 200، بدون تحویل):", rNoIndex.status);
  const afterNoIndex = await prisma.order.findUnique({ where: { id: orderTg.id }, include: { items: true } });
  console.log(
    "    وضعیت آیتم‌ها بعد از reply مبهم (باید هر دو هنوز pending باشند):",
    afterNoIndex?.items.map((i) => i.status),
  );

  // [۳.۲] reply با «آیتم 2» باید دقیقاً آیتم دوم را تحویل بدهد، نه اولی
  const rItem2 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 11,
        chat: { id: OPERATOR_CHAT_ID },
        caption: "آیتم 2",
        document: { file_id: "item2-file", file_name: "item2.zip", mime_type: "application/zip", file_size: 500_000 },
        reply_to_message: { text: orderNotifyText(orderTg.id) },
      },
    }),
  });
  console.log("[۳.۲] تحویل آیتم ۲ با ذکر شماره در تلگرام:", rItem2.status, await rItem2.json());

  const afterItem2 = await prisma.order.findUnique({
    where: { id: orderTg.id },
    include: { items: { include: { delivery: true }, orderBy: { createdAt: "asc" } } },
  });
  console.log(
    "    وضعیت آیتم‌ها (انتظار: آیتم ۱ همچنان pending، آیتم ۲ ready با فایل):",
    afterItem2?.items.map((i) => ({ status: i.status, hasFile: Boolean(i.delivery?.storageKey) })),
  );

  // [۳.۳] محدودیت ۲۰ مگابایت per-item: فایل بزرگ برای آیتم ۱ باید رد شود
  const rTooLarge = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 12,
        chat: { id: OPERATOR_CHAT_ID },
        caption: "آیتم 1",
        document: {
          file_id: "too-large-file",
          file_name: "huge.zip",
          mime_type: "application/zip",
          file_size: 21 * 1024 * 1024, // ۲۱ مگابایت، بیش از سقف ۲۰ مگابایتی هر آیتم
        },
        reply_to_message: { text: orderNotifyText(orderTg.id) },
      },
    }),
  });
  console.log("[۳.۳] فایل بیش از ۲۰ مگابایت برای آیتم ۱ (انتظار 200، بدون تحویل):", rTooLarge.status);
  const afterTooLarge = await prisma.order.findUnique({
    where: { id: orderTg.id },
    include: { items: { include: { delivery: true }, orderBy: { createdAt: "asc" } } },
  });
  console.log(
    "    آیتم ۱ باید همچنان pending و بدون delivery باشد:",
    afterTooLarge?.items[0].status,
    afterTooLarge?.items[0].delivery,
  );

  // [۳.۴] آیتم ۱ را با «/large» به‌جای فایل ۲۰+ مگابایتی تحویل بده
  const rLargeTg = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 13,
        chat: { id: OPERATOR_CHAT_ID },
        text: "آیتم 1 بزرگ",
        reply_to_message: { text: orderNotifyText(orderTg.id) },
      },
    }),
  });
  console.log("[۳.۴] علامت‌گذاری آیتم ۱ به‌عنوان فایل بزرگ در تلگرام:", rLargeTg.status, await rLargeTg.json());

  const finalTgOrder = await prisma.order.findUnique({
    where: { id: orderTg.id },
    include: { items: { include: { delivery: true }, orderBy: { createdAt: "asc" } } },
  });
  console.log(
    "[۳.۵] وضعیت نهایی سفارش تلگرام (انتظار ready، هر دو آیتم ready‌اند):",
    finalTgOrder?.status,
    finalTgOrder?.items.map((i) => ({ status: i.status, isLarge: i.delivery?.isLarge })),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
