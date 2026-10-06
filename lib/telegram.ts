// اطلاع‌رسانی سفارش از طریق تلگرام.
// در حالت شبیه‌سازی (بدون توکن تنظیم‌شده)، پیام به‌جای ارسال واقعی در کنسول سرور چاپ می‌شود.
// ارسال هرگز نباید فرآیند ثبت سفارش را بلاک یا fail کند؛ خطاها فقط لاگ می‌شوند.

import { toPersianDigits, rialToTomanLabel } from "./money";
import { STATUS_LABELS, type OrderStatus } from "./orderState";
import { getSetting } from "./settings";
import { prisma } from "./db";
import { formatOrderNumber } from "./orderNumber";
import { toJalaliDateTime } from "./jalali";

const TELEGRAM_DIRECT_BASE = "https://api.telegram.org";

/**
 * مقدار تنظیمات تلگرام را می‌خواند: اول از تنظیمات رمزنگاری‌شده‌ی پنل ادمین (اگر ادمین
 * مقداری ثبت کرده باشد)، وگرنه از متغیر محیطی هم‌نام به‌عنوان fallback (برای توسعه‌ی محلی).
 */
export async function getTelegramConfig(
  settingKey:
    | "TELEGRAM_BOT_TOKEN"
    | "TELEGRAM_CHAT_FINANCE"
    | "TELEGRAM_CHAT_OPERATOR"
    | "TELEGRAM_CHAT_SUPPORT"
    | "TELEGRAM_WEBHOOK_SECRET"
    | "TELEGRAM_API_BASE"
    | "TELEGRAM_RELAY_SECRET",
): Promise<string | null> {
  const fromDb = await getSetting(settingKey);
  if (fromDb) {
    return fromDb;
  }
  return process.env[settingKey] || null;
}

/**
 * تنها نقطه‌ی اتصال خروجی به Bot API تلگرام (پیام‌ها، getFile و دانلود فایل).
 * path بدون توکن است، مثل "/sendMessage" یا "/getFile?file_id=..."؛ kind="file" برای مسیر /file/bot<token>/<path>.
 *
 * اگر TELEGRAM_API_BASE (پنل ادمین یا env) ست باشد، درخواست به رله (Cloudflare Worker، پوشه‌ی telegram-relay/)
 * می‌رود و هدر X-Relay-Secret اضافه می‌شود — برای سرور داخل ایران که به api.telegram.org دسترسی ندارد.
 * وگرنه مستقیم به api.telegram.org. تنظیمات در هر فراخوانی خوانده می‌شوند، پس تغییر در پنل بدون ری‌استارت اثر می‌کند.
 */
export async function telegramFetch(
  token: string,
  path: string,
  init: RequestInit = {},
  kind: "bot" | "file" = "bot",
): Promise<Response> {
  const [relayBase, relaySecret] = await Promise.all([
    getTelegramConfig("TELEGRAM_API_BASE"),
    getTelegramConfig("TELEGRAM_RELAY_SECRET"),
  ]);
  const base = (relayBase?.trim() || TELEGRAM_DIRECT_BASE).replace(/\/+$/, "");
  const prefix = kind === "file" ? `/file/bot${token}` : `/bot${token}`;
  const headers = new Headers(init.headers);
  if (relayBase && relaySecret) {
    headers.set("X-Relay-Secret", relaySecret);
  }
  return fetch(`${base}${prefix}${path}`, { ...init, headers });
}

type InlineButton = { text: string; callback_data: string };
type SendOptions = { html?: boolean; buttons?: InlineButton[][] };

/** سقف طول متن یک پیام تلگرام. */
const TELEGRAM_TEXT_LIMIT = 4096;

/** پیام متنی را به یک چت تلگرام ارسال می‌کند. در نبود توکن، در کنسول لاگ می‌شود (حالت شبیه‌سازی). */
export async function sendMessage(chatId: string, text: string, options: SendOptions = {}): Promise<void> {
  const token = await getTelegramConfig("TELEGRAM_BOT_TOKEN");

  if (!token) {
    console.log(`[تلگرام شبیه‌سازی] به چت ${chatId}:\n${text}`);
    return;
  }

  try {
    const response = await telegramFetch(token, "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(options.html && { parse_mode: "HTML" }),
        ...(options.buttons && { reply_markup: { inline_keyboard: options.buttons } }),
        link_preview_options: { is_disabled: true },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[تلگرام خطا] ارسال به چت ${chatId} ناموفق بود: ${response.status} ${body}`);
    }
  } catch (error) {
    console.error(`[تلگرام خطا] ارسال به چت ${chatId} با خطا مواجه شد:`, error);
  }
}

/** پاسخ به کلیک دکمه‌ی inline تا حالت «در حال بارگذاری» روی دکمه تمام شود. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = await getTelegramConfig("TELEGRAM_BOT_TOKEN");
  if (!token) return;
  try {
    await telegramFetch(token, "/answerCallbackQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (error) {
    console.error("[تلگرام خطا] answerCallbackQuery ناموفق بود:", error);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  const { orderCode, customerLine, paymentMethodLine } = await describeOrder(orderId);

  if (financeChatId) {
    const financeText = [
      "🧾 سفارش جدید ثبت و پرداخت شد",
      `شماره سفارش: ${orderCode}`,
      customerLine,
      `تعداد آیتم‌ها: ${toPersianDigits(items.length)}`,
      `مبلغ پرداختی: ${priceLabel}`,
      paymentMethodLine,
    ].join("\n");
    void sendMessage(financeChatId, financeText);
  } else {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_FINANCE تنظیم نشده است.");
  }

  if (operatorChatId) {
    const linksText = items
      .map((item, i) => `${toPersianDigits(i + 1)}. ${item.productUrl}`)
      .join("\n");
    const instruction =
      items.length > 1
        ? "برای تحویل هر آیتم، روی همین پیام reply کن و شماره‌ی آیتم را در متن یا کپشن بنویس، مثلاً «آیتم ۲» به‌همراه فایل یا «بزرگ»."
        : "برای تحویل، روی همین پیام reply کن و فایل را بفرست، یا «بزرگ» بنویس.";
    const operatorText = [
      "📦 سفارش جدید برای پردازش",
      `شماره سفارش: ${orderCode}`,
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

function describeUser(user: { mobile: string; name: string | null }): string {
  return user.name ? `${user.name} (${user.mobile})` : user.mobile;
}

const PAYMENT_METHOD_LINES: Record<string, string> = {
  wallet: "روش پرداخت: 👛 کیف پول",
  gateway: "روش پرداخت: 💳 آنلاین (درگاه بانکی)",
};

async function describeOrder(
  orderId: string,
): Promise<{ orderCode: string; customerLine: string; paymentMethodLine: string }> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true, paymentMethod: true, user: { select: { mobile: true, name: true } } },
    });
    if (order) {
      return {
        orderCode: formatOrderNumber(order.orderNumber),
        customerLine: `کاربر: ${describeUser(order.user)}`,
        paymentMethodLine: PAYMENT_METHOD_LINES[order.paymentMethod] ?? `روش پرداخت: ${order.paymentMethod}`,
      };
    }
  } catch (error) {
    console.error(`[تلگرام خطا] خواندن سفارش ${orderId} ناموفق بود:`, error);
  }
  return { orderCode: orderId, customerLine: "کاربر: نامشخص", paymentMethodLine: "روش پرداخت: نامشخص" };
}

export type WalletChangeKind = "charge" | "admin_credit" | "admin_debit";

const WALLET_CHANGE_TITLES: Record<WalletChangeKind, string> = {
  charge: "💰 شارژ کیف پول (پرداخت آنلاین)",
  admin_credit: "➕ افزایش دستی کیف پول توسط ادمین",
  admin_debit: "➖ کاهش دستی کیف پول توسط ادمین",
};

/**
 * هر تغییر مالیِ کیف پول که با ثبت سفارش همراه نیست (شارژ آنلاین، تعدیل دستی ادمین) را برای
 * چت مالی می‌فرستد تا هیچ تراکنشی از دید مالی پنهان نماند. غیرمسدودکننده و بدون پرتاب خطا.
 */
export function notifyWalletChange(params: {
  userId: string;
  kind: WalletChangeKind;
  amountRial: bigint;
  balanceAfterRial: bigint;
  /** فقط برای تعدیل دستی: دلیل ثبت‌شده و ادمین انجام‌دهنده */
  reason?: string;
  adminLabel?: string;
}): void {
  void notifyWalletChangeAsync(params).catch((error) =>
    console.error("[تلگرام خطا] اطلاع‌رسانی تغییر کیف پول ناموفق بود:", error),
  );
}

async function notifyWalletChangeAsync(params: Parameters<typeof notifyWalletChange>[0]): Promise<void> {
  const financeChatId = await getTelegramConfig("TELEGRAM_CHAT_FINANCE");
  if (!financeChatId) {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_FINANCE تنظیم نشده است.");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { mobile: true, name: true },
  });
  const lines = [
    WALLET_CHANGE_TITLES[params.kind],
    `کاربر: ${user ? describeUser(user) : "نامشخص"}`,
    `مبلغ: ${rialToTomanLabel(Number(params.amountRial))}`,
    `موجودی بعد از تغییر: ${rialToTomanLabel(Number(params.balanceAfterRial))}`,
  ];
  if (params.adminLabel) lines.push(`ادمین: ${params.adminLabel}`);
  if (params.reason) lines.push(`دلیل: ${params.reason}`);
  await sendMessage(financeChatId, lines.join("\n"));
}

/** فایل را از تلگرام دانلود می‌کند. بدون TELEGRAM_BOT_TOKEN (حالت شبیه‌سازی)، محتوای جعلی تولید می‌شود. */
export async function downloadTelegramFile(fileId: string, fileName?: string): Promise<Buffer> {
  const token = await getTelegramConfig("TELEGRAM_BOT_TOKEN");
  if (!token) {
    console.log(`[تلگرام شبیه‌سازی] دانلود فایل ${fileName ?? fileId} به‌صورت شبیه‌سازی انجام شد.`);
    return Buffer.from(`simulated-file-content:${fileId}:${fileName ?? ""}`);
  }

  const infoRes = await telegramFetch(token, `/getFile?file_id=${encodeURIComponent(fileId)}`);
  const info = await infoRes.json().catch(() => null);
  if (!infoRes.ok) {
    throw new Error(`دریافت اطلاعات فایل از تلگرام ناموفق بود (${infoRes.status}: ${info?.description ?? "بدون توضیح"}).`);
  }
  const filePath = info?.result?.file_path;
  if (!filePath) {
    throw new Error("مسیر فایل در پاسخ تلگرام یافت نشد.");
  }

  const fileRes = await telegramFetch(token, `/${filePath}`, {}, "file");
  if (!fileRes.ok) {
    throw new Error("دانلود فایل از تلگرام ناموفق بود.");
  }
  return Buffer.from(await fileRes.arrayBuffer());
}

const RECENT_HISTORY_COUNT = 6;
const RECENT_MESSAGE_MAX_CHARS = 280;

export const SUPPORT_CALLBACK = { history: "hist", orders: "orders" } as const;

type HistoryMessage = { sender: string; text: string; createdAt: Date };

function formatHistoryEntry(m: HistoryMessage, maxChars?: number): string {
  const who = m.sender === "user" ? "👤 کاربر" : "🎧 پشتیبانی";
  const text = maxChars && m.text.length > maxChars ? `${m.text.slice(0, maxChars)}…` : m.text;
  return `<blockquote><b>${who}</b> · ${toJalaliDateTime(m.createdAt)}\n${escapeHtml(text)}</blockquote>`;
}

// خط «شناسه کاربر:» را وب‌هوک برای تشخیص reply پشتیبانی می‌خواند؛ نباید حذف یا تغییر شکل داده شود.
const replyFooter = (userId: string) => `↩️ برای پاسخ، روی همین پیام reply کن.\n🆔 شناسه کاربر: <code>${userId}</code>`;

const supportButtons = (userId: string): InlineButton[][] => [
  [
    { text: "📜 کل گفتگو", callback_data: `${SUPPORT_CALLBACK.history}:${userId}` },
    { text: "📦 سفارش‌های کاربر", callback_data: `${SUPPORT_CALLBACK.orders}:${userId}` },
  ],
];

/**
 * پیام جدید کاربر را همراه با معرفی کاربر و چند پیام اخیر گفتگو به چت پشتیبانی می‌فرستد تا
 * پشتیبان بدون جست‌وجو بفهمد قبلاً چه گفته شده؛ پشتیبانی با reply روی همین پیام جواب می‌دهد.
 */
export function notifySupportMessage(params: { userId: string; messageId: string; text: string }): void {
  void notifySupportMessageAsync(params).catch((error) =>
    console.error("[تلگرام خطا] اطلاع‌رسانی پیام پشتیبانی ناموفق بود:", error),
  );
}

async function notifySupportMessageAsync(params: { userId: string; messageId: string; text: string }): Promise<void> {
  const { userId, messageId, text } = params;

  const supportChatId = await getTelegramConfig("TELEGRAM_CHAT_SUPPORT");
  if (!supportChatId) {
    console.error("[تلگرام خطا] TELEGRAM_CHAT_SUPPORT تنظیم نشده است.");
    return;
  }

  const [user, totalMessages, recent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { mobile: true, name: true, _count: { select: { orders: true } } },
    }),
    prisma.supportMessage.count({ where: { userId } }),
    prisma.supportMessage.findMany({
      where: { userId, id: { not: messageId } },
      orderBy: { createdAt: "desc" },
      take: RECENT_HISTORY_COUNT,
    }),
  ]);
  if (!user) return;

  const earlier = totalMessages - 1 - recent.length;
  const lines = [
    "💬 <b>پیام جدید پشتیبانی</b>",
    `👤 <b>${escapeHtml(describeUser(user))}</b>`,
    `📊 ${toPersianDigits(totalMessages)} پیام در گفتگو · ${toPersianDigits(user._count.orders)} سفارش`,
    "",
  ];
  if (recent.length > 0) {
    lines.push("<b>━━ گفتگوی اخیر ━━</b>");
    if (earlier > 0) lines.push(`<i>… ${toPersianDigits(earlier)} پیام قدیمی‌تر (دکمه‌ی «کل گفتگو»)</i>`);
    lines.push(...recent.reverse().map((m) => formatHistoryEntry(m, RECENT_MESSAGE_MAX_CHARS)), "");
  } else {
    lines.push("<i>اولین پیام این کاربر است.</i>", "");
  }
  lines.push("<b>━━ پیام جدید ━━</b>", `<b>${escapeHtml(text)}</b>`, "", replyFooter(userId));

  await sendMessage(supportChatId, lines.join("\n"), { html: true, buttons: supportButtons(userId) });
}

/** کل گفتگوی یک کاربر را (در چند پیام اگر طولانی باشد) به چت پشتیبانی می‌فرستد. */
export async function sendSupportHistory(chatId: string, userId: string): Promise<void> {
  const [user, messages] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { mobile: true, name: true } }),
    prisma.supportMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!user) {
    await sendMessage(chatId, "⚠️ کاربر یافت نشد.");
    return;
  }

  const header = `📜 <b>کل گفتگو با ${escapeHtml(describeUser(user))}</b> · ${toPersianDigits(messages.length)} پیام`;
  const footer = replyFooter(userId);
  const chunks: string[] = [];
  let current = header;
  for (const entry of messages.map((m) => formatHistoryEntry(m, TELEGRAM_TEXT_LIMIT / 2))) {
    if (current.length + entry.length + footer.length + 2 > TELEGRAM_TEXT_LIMIT) {
      chunks.push(current);
      current = "";
    }
    current += `\n${entry}`;
  }
  chunks.push(`${current}\n\n${footer}`);

  for (const chunk of chunks) {
    await sendMessage(chatId, chunk, { html: true });
  }
}

/** چند سفارش اخیر کاربر را با وضعیت هر کدام برای پشتیبانی می‌فرستد. */
export async function sendUserOrdersSummary(chatId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mobile: true,
      name: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { orderNumber: true, status: true, createdAt: true, totalPriceRial: true, _count: { select: { items: true } } },
      },
    },
  });
  if (!user) {
    await sendMessage(chatId, "⚠️ کاربر یافت نشد.");
    return;
  }

  const rows = user.orders.map(
    (o) =>
      `• <code>${formatOrderNumber(o.orderNumber)}</code> · ${STATUS_LABELS[o.status as OrderStatus] ?? o.status} · ${toPersianDigits(o._count.items)} آیتم · ${rialToTomanLabel(Number(o.totalPriceRial))} · ${toJalaliDateTime(o.createdAt)}`,
  );
  const text = [
    `📦 <b>سفارش‌های اخیر ${escapeHtml(describeUser(user))}</b>`,
    "",
    rows.length > 0 ? rows.join("\n") : "<i>سفارشی ثبت نکرده است.</i>",
  ].join("\n");
  await sendMessage(chatId, text, { html: true });
}
