// اطلاع‌رسانی سفارش از طریق تلگرام.
// در حالت شبیه‌سازی (بدون توکن تنظیم‌شده)، پیام به‌جای ارسال واقعی در کنسول سرور چاپ می‌شود.
// ارسال هرگز نباید فرآیند ثبت سفارش را بلاک یا fail کند؛ خطاها فقط لاگ می‌شوند.

import { toPersianDigits } from "./money";
import { getSetting } from "./settings";
import { prisma } from "./db";

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * مقدار تنظیمات تلگرام را می‌خواند: اول از تنظیمات رمزنگاری‌شده‌ی پنل ادمین (اگر ادمین
 * مقداری ثبت کرده باشد)، وگرنه از متغیر محیطی هم‌نام به‌عنوان fallback (برای توسعه‌ی محلی).
 */
export async function getTelegramConfig(
  settingKey: "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_FINANCE" | "TELEGRAM_CHAT_OPERATOR" | "TELEGRAM_CHAT_SUPPORT" | "TELEGRAM_WEBHOOK_SECRET",
): Promise<string | null> {
  const fromDb = await getSetting(settingKey);
  if (fromDb) {
    return fromDb;
  }
  return process.env[settingKey] || null;
}

/** پیام متنی را به یک چت تلگرام ارسال می‌کند. در نبود توکن، در کنسول لاگ می‌شود (حالت شبیه‌سازی). */
export async function sendMessage(chatId: string, text: string): Promise<void> {
  const token = await getTelegramConfig("TELEGRAM_BOT_TOKEN");

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
  void notifyOrderCreatedAsync(params);
}

async function notifyOrderCreatedAsync(params: {
  orderId: string;
  priceLabel: string;
  items: { productUrl: string }[];
}): Promise<void> {
  const { orderId, priceLabel, items } = params;

  const financeChatId = await getTelegramConfig("TELEGRAM_CHAT_FINANCE");
  const operatorChatId = await getTelegramConfig("TELEGRAM_CHAT_OPERATOR");

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
    const customerLine = await describeOrderCustomer(orderId);
    const linksText = items
      .map((item, i) => `${toPersianDigits(i + 1)}. ${item.productUrl}`)
      .join("\n");
    const instruction =
      items.length > 1
        ? "برای تحویل هر آیتم، روی همین پیام reply کن و شماره‌ی آیتم را در متن یا کپشن بنویس، مثلاً «آیتم 2» به‌همراه فایل یا دستور /large."
        : "برای تحویل، روی همین پیام reply کن و فایل را بفرست، یا با دستور /large آن را فایل بزرگ علامت بزن.";
    const operatorText = [
      "📦 سفارش جدید برای پردازش",
      `شماره سفارش: ${orderId}`,
      customerLine,
      linksText,
      "",
      instruction,
    ].join("\n");
    void sendMessage(operatorChatId, operatorText);
  } else {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_OPERATOR تنظیم نشده است.");
  }
}

async function describeOrderCustomer(orderId: string): Promise<string> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { user: { select: { mobile: true, name: true } } },
    });
    if (!order) {
      return "کاربر: نامشخص";
    }
    const { mobile, name } = order.user;
    return name ? `کاربر: ${name} (${mobile})` : `کاربر: ${mobile}`;
  } catch (error) {
    console.error(`[تلگرام خطا] خواندن کاربر سفارش ${orderId} ناموفق بود:`, error);
    return "کاربر: نامشخص";
  }
}

/** فایل را از تلگرام دانلود می‌کند. بدون TELEGRAM_BOT_TOKEN (حالت شبیه‌سازی)، محتوای جعلی تولید می‌شود. */
export async function downloadTelegramFile(fileId: string, fileName?: string): Promise<Buffer> {
  const token = await getTelegramConfig("TELEGRAM_BOT_TOKEN");
  if (!token) {
    console.log(`[تلگرام شبیه‌سازی] دانلود فایل ${fileName ?? fileId} به‌صورت شبیه‌سازی انجام شد.`);
    return Buffer.from(`simulated-file-content:${fileId}:${fileName ?? ""}`);
  }

  const infoRes = await fetch(`${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const info = await infoRes.json().catch(() => null);
  if (!infoRes.ok) {
    throw new Error(`دریافت اطلاعات فایل از تلگرام ناموفق بود (${infoRes.status}: ${info?.description ?? "بدون توضیح"}).`);
  }
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
  void notifySupportMessageAsync(params);
}

async function notifySupportMessageAsync(params: { userId: string; text: string }): Promise<void> {
  const { userId, text } = params;

  const supportChatId = await getTelegramConfig("TELEGRAM_CHAT_SUPPORT");
  if (!supportChatId) {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_SUPPORT تنظیم نشده است.");
    return;
  }

  const supportText = ["💬 پیام جدید از کاربر", `شناسه کاربر: ${userId}`, "", text].join("\n");
  void sendMessage(supportChatId, supportText);
}
