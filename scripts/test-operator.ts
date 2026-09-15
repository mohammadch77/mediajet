// تست پنل اپراتور: صف سفارش‌ها، تغییر وضعیت طبق state machine، ثبت تحویل، و کنترل دسترسی.
// برای سادگی، session به‌جای جریان OTP کامل، مستقیم در دیتابیس ساخته می‌شود (همان هش‌سازی lib/session.ts).
// نیازمند اجرای سرور dev (BASE_URL قابل تنظیم).

import crypto from "crypto";
import { prisma } from "../lib/db";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "mediajet_session";

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

async function main() {
  // اپراتور
  const operatorMobile = "0938" + Math.floor(1000000 + Math.random() * 8999999);
  const operator = await prisma.user.create({
    data: { mobile: operatorMobile, role: "operator", wallet: { create: { balanceRial: 0n } } },
  });
  const operatorCookie = await makeSessionCookie(operator.id);
  console.log("اپراتور ساخته شد:", operator.id);

  // کاربر عادی + کیف پول
  const userMobile = "0937" + Math.floor(1000000 + Math.random() * 8999999);
  const user = await prisma.user.create({
    data: { mobile: userMobile, wallet: { create: { balanceRial: 5_000_000n } } },
  });
  const userCookie = await makeSessionCookie(user.id);
  console.log("کاربر عادی ساخته شد:", user.id);

  // سفارش در وضعیت‌های مختلف (مستقیم در دیتابیس، برای شبیه‌سازی صف)
  const orderQueued = await prisma.order.create({
    data: {
      userId: user.id,
      totalPriceRial: 700000n,
      paymentMethod: "wallet",
      status: "queued",
      items: { create: { sourceSite: "Freepik", category: "vector", productUrl: "https://freepik.com/a", priceRial: 700000n } },
    },
  });
  const orderProcessing = await prisma.order.create({
    data: {
      userId: user.id,
      totalPriceRial: 1200000n,
      paymentMethod: "wallet",
      status: "processing",
      items: { create: { sourceSite: "Envato", category: "video", productUrl: "https://envato.com/b", priceRial: 1200000n } },
    },
  });
  console.log("سفارش‌های تست ساخته شدند:", orderQueued.id, orderProcessing.id);

  // [۱] دیدن صف توسط اپراتور
  const r1 = await fetch(`${BASE_URL}/api/operator/orders?status=queued`, { headers: { Cookie: operatorCookie } });
  const d1 = await r1.json();
  console.log("\n[۱] صف queued برای اپراتور:", r1.status, "تعداد:", d1.orders?.length);

  // [۲] queued → processing (مجاز)
  const r2 = await fetch(`${BASE_URL}/api/operator/orders/${orderQueued.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: operatorCookie },
    body: JSON.stringify({ toStatus: "processing" }),
  });
  console.log("[۲] queued → processing:", r2.status, await r2.json());

  // [۳] انتقال نامعتبر: queued → delivered مستقیم (باید رد شود)
  const orderInvalid = await prisma.order.create({
    data: {
      userId: user.id,
      totalPriceRial: 300000n,
      paymentMethod: "wallet",
      status: "queued",
      items: { create: { sourceSite: "Flaticon", category: "icon", productUrl: "https://flaticon.com/c", priceRial: 300000n } },
    },
  });
  const r3 = await fetch(`${BASE_URL}/api/operator/orders/${orderInvalid.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: operatorCookie },
    body: JSON.stringify({ toStatus: "delivered" }),
  });
  console.log("[۳] انتقال نامعتبر queued → delivered (انتظار 422):", r3.status, await r3.json());

  // [۴] ثبت تحویل روی سفارش processing → ready
  const r4 = await fetch(`${BASE_URL}/api/operator/orders/${orderProcessing.id}/deliver`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: operatorCookie },
    body: JSON.stringify({ fileUrl: "https://cdn.example.com/delivery/file.zip" }),
  });
  console.log("[۴] ثبت تحویل processing → ready:", r4.status, await r4.json());

  // [۵] ready → delivered
  const r5 = await fetch(`${BASE_URL}/api/operator/orders/${orderProcessing.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: operatorCookie },
    body: JSON.stringify({ toStatus: "delivered" }),
  });
  console.log("[۵] ready → delivered:", r5.status, await r5.json());

  // [۶] کاربر عادی به endpoint اپراتور دسترسی ندارد (انتظار 403)
  const r6 = await fetch(`${BASE_URL}/api/operator/orders`, { headers: { Cookie: userCookie } });
  console.log("[۶] کاربر عادی → GET صف اپراتور (انتظار 403):", r6.status, await r6.json());

  const r7 = await fetch(`${BASE_URL}/api/operator/orders/${orderQueued.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: userCookie },
    body: JSON.stringify({ toStatus: "processing" }),
  });
  console.log("[۷] کاربر عادی → تغییر وضعیت (انتظار 403):", r7.status, await r7.json());

  // بازبینی نهایی
  const finalOrder = await prisma.order.findUnique({
    where: { id: orderProcessing.id },
    include: { events: true, items: { include: { delivery: true } } },
  });
  console.log("\nوضعیت نهایی سفارش:", finalOrder?.status, "(انتظار: delivered)");
  console.log("لینک تحویل:", finalOrder?.items[0]?.delivery?.fileUrl);
  console.log("رویدادها:", finalOrder?.events.map((e: { fromStatus: string | null; toStatus: string; actor: string }) => `${e.fromStatus} → ${e.toStatus} (${e.actor})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
