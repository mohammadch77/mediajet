// تست صندوق پیام دوطرفه‌ی پشتیبانی: کاربر پیام می‌فرستد (ثبت + نوتیف تلگرام)،
// پشتیبانی از تلگرام reply می‌کند (پیام در صندوق کاربر می‌نشیند)، پیام از آیدی غیرمجاز رد می‌شود،
// و نشانه‌ی خوانده‌نشده کار می‌کند.
// نیازمند اجرای سرور dev (BASE_URL قابل تنظیم).

import crypto from "crypto";
import { prisma } from "../lib/db";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "mediajet_session";
const SUPPORT_CHAT_ID = process.env.TELEGRAM_CHAT_SUPPORT ?? "222222";

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

function supportNotifyText(userId: string, text: string): string {
  return `💬 پیام جدید از کاربر\nشناسه کاربر: ${userId}\n\n${text}`;
}

async function main() {
  process.env.TELEGRAM_CHAT_SUPPORT = SUPPORT_CHAT_ID;

  const mobile = "0937" + Math.floor(1000000 + Math.random() * 8999999);
  const user = await prisma.user.create({
    data: { mobile, wallet: { create: { balanceRial: 0n } } },
  });
  const cookie = await makeSessionCookie(user.id);
  console.log("کاربر تست ساخته شد:", user.id);

  // [۱] کاربر پیام می‌فرستد
  const r1 = await fetch(`${BASE_URL}/api/support/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ text: "سلام، سفارشم هنوز پردازش نشده؟" }),
  });
  const m1 = await r1.json();
  console.log("[۱] ارسال پیام کاربر (انتظار 200):", r1.status, m1);

  const afterUserMessage = await prisma.supportMessage.findMany({ where: { userId: user.id } });
  console.log("    تعداد پیام‌های ثبت‌شده (انتظار ۱):", afterUserMessage.length);

  // [۲] پیام از آیدی غیرمجاز باید رد شود
  const r2 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 10,
        chat: { id: "999999" },
        text: "پیام قلابی از هکر",
        reply_to_message: { text: supportNotifyText(user.id, "سلام، سفارشم هنوز پردازش نشده؟") },
      },
    }),
  });
  console.log("[۲] reply از چت غیرمجاز (انتظار 200 و بی‌اثر):", r2.status);

  const afterUnauthorized = await prisma.supportMessage.findMany({ where: { userId: user.id } });
  console.log("    تعداد پیام‌ها بعد از reply غیرمجاز (باید همچنان ۱ باشد):", afterUnauthorized.length);

  // [۳] پشتیبانی از تلگرام reply می‌کند
  const r3 = await fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        message_id: 11,
        chat: { id: SUPPORT_CHAT_ID },
        text: "سلام، تا ۱۰ دقیقه دیگر آماده می‌شود.",
        reply_to_message: { text: supportNotifyText(user.id, "سلام، سفارشم هنوز پردازش نشده؟") },
      },
    }),
  });
  console.log("[۳] reply پشتیبانی از تلگرام (انتظار 200):", r3.status);

  const afterSupportReply = await prisma.supportMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(
    "    پیام‌های صندوق بعد از reply پشتیبانی:",
    afterSupportReply.map((m) => `${m.sender}: ${m.text} (readByUser=${m.readByUser})`),
  );

  // [۴] نشانه‌ی خوانده‌نشده باید فعال باشد
  const r4 = await fetch(`${BASE_URL}/api/support/messages`, { headers: { Cookie: cookie } });
  const data4 = await r4.json();
  console.log("[۴] hasUnread قبل از باز کردن صندوق (انتظار true):", data4.hasUnread);

  // [۵] باز کردن صندوق (PATCH) باید readByUser را true کند
  const r5 = await fetch(`${BASE_URL}/api/support/messages`, { method: "PATCH", headers: { Cookie: cookie } });
  console.log("[۵] علامت‌گذاری خوانده‌شده (انتظار 200):", r5.status);

  const r6 = await fetch(`${BASE_URL}/api/support/messages`, { headers: { Cookie: cookie } });
  const data6 = await r6.json();
  console.log("[۶] hasUnread بعد از باز کردن صندوق (انتظار false):", data6.hasUnread);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
