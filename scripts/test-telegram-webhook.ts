// تست webhook تلگرام: شبیه‌سازی آپدیت‌های جعلی تلگرام به‌جای وبهوک واقعی (که نیاز به سرور عمومی دارد).
// سه مسیر بررسی می‌شود: فایل کوچک (ذخیره و دانلود در پنل کاربر)، فایل بزرگ (پیام پشتیبانی)،
// و امنیت (رد پیام از chat غیرمجاز).
// نیازمند اجرای سرور dev (BASE_URL قابل تنظیم) و TELEGRAM_CHAT_OPERATOR در .env.

import crypto from "crypto";
import { prisma } from "../lib/db";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "mediajet_session";
const OPERATOR_CHAT_ID = process.env.TELEGRAM_CHAT_OPERATOR ?? "111111";

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
  return `📦 سفارش جدید برای پردازش\nشماره سفارش: ${orderId}\nلینک محصول: https://example.com/p`;
}

async function main() {
  process.env.TELEGRAM_CHAT_OPERATOR = OPERATOR_CHAT_ID;

  const userMobile = "0935" + Math.floor(1000000 + Math.random() * 8999999);
  const user = await prisma.user.create({
    data: { mobile: userMobile, wallet: { create: { balanceRial: 5_000_000n } } },
  });
  const userCookie = await makeSessionCookie(user.id);
  console.log("کاربر تست ساخته شد:", user.id);

  const orderSmall = await prisma.order.create({
    data: { userId: user.id, sourceSite: "Freepik", category: "vector", productUrl: "https://freepik.com/a", priceRial: 700000n, status: "queued" },
  });
  const orderLarge = await prisma.order.create({
    data: { userId: user.id, sourceSite: "Envato", category: "video", productUrl: "https://envato.com/b", priceRial: 1200000n, status: "processing" },
  });
  console.log("سفارش‌های تست:", { small: orderSmall.id, large: orderLarge.id });

  // [۱] امنیت: پیام از چت غیرمجاز باید نادیده گرفته شود
  const r1 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 1,
        chat: { id: "999999" },
        document: { file_id: "fake", file_name: "hack.zip", mime_type: "application/zip", file_size: 1000 },
        reply_to_message: { text: orderNotifyText(orderSmall.id) },
      },
    }),
  });
  console.log("[۱] پیام از چت غیرمجاز (انتظار 200 و بی‌اثر):", r1.status);

  const afterUnauthorized = await prisma.order.findUnique({ where: { id: orderSmall.id }, include: { delivery: true } });
  console.log("    وضعیت سفارش بعد از پیام غیرمجاز (باید همچنان queued باشد):", afterUnauthorized?.status, "| delivery:", afterUnauthorized?.delivery);

  // [۲] فایل کوچک: اپراتور روی پیام سفارش reply می‌کند و فایل می‌فرستد
  const r2 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 2,
        chat: { id: OPERATOR_CHAT_ID },
        document: { file_id: "file-small-1", file_name: "design.zip", mime_type: "application/zip", file_size: 500_000 },
        reply_to_message: { text: orderNotifyText(orderSmall.id) },
      },
    }),
  });
  console.log("[۲] تحویل فایل کوچک:", r2.status, await r2.json());

  const smallOrder = await prisma.order.findUnique({ where: { id: orderSmall.id }, include: { delivery: true, events: true } });
  console.log("    وضعیت سفارش کوچک (انتظار ready):", smallOrder?.status);
  console.log("    delivery:", smallOrder?.delivery);
  console.log("    رویدادها:", smallOrder?.events.map((e) => `${e.fromStatus} → ${e.toStatus} (${e.actor})`));

  // [۲.۱] دانلود از پنل کاربر (endpoint محافظت‌شده)
  const rDownload = await fetch(`${BASE_URL}/api/orders/${orderSmall.id}/download`, { headers: { Cookie: userCookie } });
  const downloadBody = await rDownload.text();
  console.log("[۲.۱] دانلود فایل توسط مالک سفارش (انتظار 200):", rDownload.status, "طول محتوا:", downloadBody.length);

  // [۲.۲] کاربر دیگر نباید بتواند فایل را دانلود کند
  const otherMobile = "0936" + Math.floor(1000000 + Math.random() * 8999999);
  const otherUser = await prisma.user.create({ data: { mobile: otherMobile, wallet: { create: { balanceRial: 0n } } } });
  const otherCookie = await makeSessionCookie(otherUser.id);
  const rDownloadOther = await fetch(`${BASE_URL}/api/orders/${orderSmall.id}/download`, { headers: { Cookie: otherCookie } });
  console.log("[۲.۲] دانلود توسط کاربر غیرمالک (انتظار 404):", rDownloadOther.status);

  // [۳] فایل بزرگ: اپراتور با دستور «/large» پاسخ می‌دهد (بدون فایل)
  const r3 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 3,
        chat: { id: OPERATOR_CHAT_ID },
        text: "/large",
        reply_to_message: { text: orderNotifyText(orderLarge.id) },
      },
    }),
  });
  console.log("[۳] علامت‌گذاری فایل بزرگ:", r3.status, await r3.json());

  const largeOrder = await prisma.order.findUnique({ where: { id: orderLarge.id }, include: { delivery: true } });
  console.log("    وضعیت سفارش بزرگ (انتظار ready):", largeOrder?.status, "| isLarge:", largeOrder?.delivery?.isLarge);

  // [۳.۱] در پنل کاربر باید پیام پشتیبانی نمایش داده شود، نه لینک دانلود
  const rOrders = await fetch(`${BASE_URL}/api/orders`, { headers: { Cookie: userCookie } });
  const ordersData = await rOrders.json();
  const largeInPanel = ordersData.orders.find((o: { id: string }) => o.id === orderLarge.id);
  const smallInPanel = ordersData.orders.find((o: { id: string }) => o.id === orderSmall.id);
  console.log("[۳.۱] سفارش بزرگ در پنل:", { downloadUrl: largeInPanel?.downloadUrl, supportMessage: largeInPanel?.supportMessage });
  console.log("    سفارش کوچک در پنل:", { downloadUrl: smallInPanel?.downloadUrl, supportMessage: smallInPanel?.supportMessage });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
