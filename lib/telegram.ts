// اطلاع‌رسانی سفارش از طریق تلگرام.
// در حالت شبیه‌سازی (بدون توکن تنظیم‌شده)، پیام به‌جای ارسال واقعی در کنسول سرور چاپ می‌شود.
// ارسال هرگز نباید فرآیند ثبت سفارش را بلاک یا fail کند؛ خطاها فقط لاگ می‌شوند.

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

/** پیام‌های اطلاع‌رسانی سفارش را به‌صورت غیرمسدودکننده به چت‌های مالی و اپراتور ارسال می‌کند. */
export function notifyOrderCreated(params: {
  orderId: string;
  priceLabel: string;
  productUrl: string;
}): void {
  const { orderId, priceLabel, productUrl } = params;

  const financeChatId = process.env.TELEGRAM_CHAT_FINANCE;
  const operatorChatId = process.env.TELEGRAM_CHAT_OPERATOR;

  if (financeChatId) {
    const financeText = [
      "🧾 سفارش جدید ثبت و پرداخت شد",
      `شماره سفارش: ${orderId}`,
      `مبلغ پرداختی: ${priceLabel}`,
      `لینک محصول: ${productUrl}`,
    ].join("\n");
    void sendMessage(financeChatId, financeText);
  } else {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_FINANCE تنظیم نشده است.");
  }

  if (operatorChatId) {
    const operatorText = [
      "📦 سفارش جدید برای پردازش",
      `شماره سفارش: ${orderId}`,
      `لینک محصول: ${productUrl}`,
    ].join("\n");
    void sendMessage(operatorChatId, operatorText);
  } else {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_OPERATOR تنظیم نشده است.");
  }
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
