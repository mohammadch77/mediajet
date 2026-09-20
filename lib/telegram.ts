// اطلاع‌رسانی سفارش از طریق تلگرام.
// در حالت شبیه‌سازی (بدون توکن تنظیم‌شده)، پیام به‌جای ارسال واقعی در کنسول سرور چاپ می‌شود.
// ارسال هرگز نباید فرآیند ثبت سفارش را بلاک یا fail کند؛ خطاها فقط لاگ می‌شوند.

import { toPersianDigits } from "./money";

const TELEGRAM_API_BASE = "https://api.telegram.org";

/** پیام متنی را به یک چت تلگرام ارسال می‌کند. در نبود توکن، در کنسول لاگ می‌شود (حالت شبیه‌سازی). */
export async function sendMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log(`[تلگرام شبیه‌سازی] به چت ${chatId}:\n${text}`);
    return;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[تلگرام خطا] ارسال به چت ${chatId} ناموفق بود: ${response.status} ${body}`);
    }
  } catch (error) {
    console.error(`[تلگرام خطا] ارسال به چت ${chatId} با خطا مواجه شد:`, error);
  }
}

/**
 * پیام‌های اطلاع‌رسانی سفارش را به‌صورت غیرمسدودکننده به چت‌های مالی و اپراتور ارسال می‌کند.
 * برای سفارش تک‌آیتمی و چندآیتمی (تسویه‌ی سبد خرید) یکسان کار می‌کند: همه‌ی لینک‌ها در یک
 * پیام با شماره‌ی سفارش برای اپراتور فهرست می‌شوند.
 */
export function notifyOrderCreated(params: {
  orderId: string;
  priceLabel: string;
  items: { productUrl: string }[];
}): void {
  const { orderId, priceLabel, items } = params;

  const financeChatId = process.env.TELEGRAM_CHAT_FINANCE;
  const operatorChatId = process.env.TELEGRAM_CHAT_OPERATOR;

  if (financeChatId) {
    const financeText = [
      "🧾 سفارش جدید ثبت و پرداخت شد",
      `شماره سفارش: ${orderId}`,
      `تعداد آیتم‌ها: ${toPersianDigits(items.length)}`,
      `مبلغ پرداختی: ${priceLabel}`,
    ].join("\n");
    void sendMessage(financeChatId, financeText);
  } else {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_FINANCE تنظیم نشده است.");
  }

  if (operatorChatId) {
    const linksText = items
      .map((item, i) => `${toPersianDigits(i + 1)}. ${item.productUrl}`)
      .join("\n");
    const operatorText = [
      "📦 سفارش جدید برای پردازش",
      `شماره سفارش: ${orderId}`,
      linksText,
    ].join("\n");
    void sendMessage(operatorChatId, operatorText);
  } else {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_OPERATOR تنظیم نشده است.");
  }
}

/** فایل را از تلگرام دانلود می‌کند. بدون TELEGRAM_BOT_TOKEN (حالت شبیه‌سازی)، محتوای جعلی تولید می‌شود. */
export async function downloadTelegramFile(fileId: string, fileName?: string): Promise<Buffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[تلگرام شبیه‌سازی] دانلود فایل ${fileName ?? fileId} به‌صورت شبیه‌سازی انجام شد.`);
    return Buffer.from(`simulated-file-content:${fileId}:${fileName ?? ""}`);
  }

  const infoRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${fileId}`);
  if (!infoRes.ok) {
    throw new Error("دریافت اطلاعات فایل از تلگرام ناموفق بود.");
  }
  const info = await infoRes.json();
  const filePath = info?.result?.file_path;
  if (!filePath) {
    throw new Error("مسیر فایل در پاسخ تلگرام یافت نشد.");
  }

  const fileRes = await fetch(`${TELEGRAM_API_BASE}/file/bot${token}/${filePath}`);
  if (!fileRes.ok) {
    throw new Error("دانلود فایل از تلگرام ناموفق بود.");
  }
  return Buffer.from(await fileRes.arrayBuffer());
}

/** پیام جدید کاربر در صندوق پشتیبانی را به چت پشتیبانی اطلاع می‌دهد؛ پشتیبانی با reply روی این پیام جواب می‌دهد. */
export function notifySupportMessage(params: { userId: string; text: string }): void {
  const { userId, text } = params;

  const supportChatId = process.env.TELEGRAM_CHAT_SUPPORT;
  if (!supportChatId) {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_SUPPORT تنظیم نشده است.");
    return;
  }

  const supportText = ["💬 پیام جدید از کاربر", `شناسه کاربر: ${userId}`, "", text].join("\n");
  void sendMessage(supportChatId, supportText);
}
