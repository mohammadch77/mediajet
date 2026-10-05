// دسترسی امن به تنظیمات حساس سیستم (کلید درگاه پرداخت، کلید پنل پیامک و مشابه).
//
// مقدار رمزگشایی‌شده فقط از طریق getSetting در سمت سرور خوانده می‌شود (مثلاً وقتی
// می‌خواهیم به درگاه پرداخت واقعی وصل شویم) و هرگز به کلاینت ارسال نمی‌شود. لیست
// وضعیت تنظیمات (تنظیم‌شده/نشده) که به UI ادمین می‌رود هیچ‌وقت شامل مقدار واقعی نیست.

import { prisma } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";

export type SettingKey = (typeof SETTING_DEFS)[number]["key"];

export const SETTING_DEFS = [
  {
    key: "ZARINPAL_MERCHANT_ID",
    group: "gateway",
    label: "کلید مرچنت زرین‌پال",
    description: "شناسه‌ی مرچنت درگاه پرداخت زرین‌پال برای شارژ کیف پول کاربران.",
  },
  {
    key: "SMS_PANEL_API_KEY",
    group: "sms",
    label: "کلید API پنل پیامک",
    description: "کلید API ایران‌پیامک (از پنل کاربری ایران‌پیامک) برای ارسال کد ورود (OTP) و بازیابی رمز.",
  },
  {
    key: "SMS_LINE_NUMBER",
    group: "sms",
    label: "شماره‌ی خط ارسال پیامک",
    description:
      "شماره‌ی خط (اختصاصی یا خدماتی) که پیامک‌ها از آن ارسال می‌شوند، دقیقاً مثل پنل ایران‌پیامک. بدون این مقدار، ارسال واقعی انجام نمی‌شود.",
  },
  {
    key: "SMS_OTP_PATTERN_CODE",
    group: "sms",
    label: "کد پترن پیامک ورود (OTP)",
    description:
      "کد پترن تأییدشده‌ی ایران‌پیامک برای کد ورود (مثلاً tCy5SnedqM). متن پترن باید یک متغیر به نام code داشته باشد، مثل «کد ورود شما به گت استوک: %code%». پترن باید در پنل ایران‌پیامک «تأیید شده» باشد. اگر خالی بماند، کد به‌صورت متن ساده ارسال می‌شود.",
  },
  {
    key: "PASSWORD_RESET_SMS_MODE",
    group: "sms",
    label: "روش پیامک بازیابی رمز",
    description:
      "یکی از code (فقط کد ۶ رقمی — سازگار با همه‌ی پنل‌ها)، link (فقط لینک کوتاه) یا both (هر دو در یک پیامک). برای لینک، APP_BASE_URL باید در env تنظیم باشد؛ وگرنه کد ارسال می‌شود. پیش‌فرض: code.",
  },
  {
    key: "TELEGRAM_BOT_TOKEN",
    group: "telegram",
    label: "توکن ربات تلگرام",
    description: "توکن ربات (از BotFather) برای ارسال و دریافت پیام. بدون این مقدار، ارسال به‌صورت شبیه‌سازی در کنسول سرور انجام می‌شود.",
  },
  {
    key: "TELEGRAM_CHAT_FINANCE",
    group: "telegram",
    label: "چت مالی",
    description: "شناسه‌ی چت تلگرام که اطلاع‌رسانی پرداخت هر سفارش به آن ارسال می‌شود.",
  },
  {
    key: "TELEGRAM_CHAT_OPERATOR",
    group: "telegram",
    label: "چت اپراتور",
    description: "شناسه‌ی چت تلگرام اپراتور که سفارش‌های جدید برای تحویل به آن ارسال می‌شود؛ اپراتور با reply روی پیام سفارش، فایل را تحویل می‌دهد.",
  },
  {
    key: "TELEGRAM_CHAT_SUPPORT",
    group: "telegram",
    label: "چت پشتیبانی",
    description: "شناسه‌ی چت تلگرام پشتیبانی که پیام‌های کاربران به آن ارسال می‌شود؛ پشتیبانی با reply روی پیام کاربر پاسخ می‌دهد.",
  },
  {
    key: "TELEGRAM_WEBHOOK_SECRET",
    group: "telegram",
    label: "رمز وب‌هوک تلگرام",
    description: "مقداری که هنگام setWebhook به تلگرام داده می‌شود تا فقط درخواست‌های واقعی تلگرام (با هدر secret token) پذیرفته شوند.",
  },
  {
    key: "TELEGRAM_API_BASE",
    group: "telegram",
    label: "آدرس رله‌ی تلگرام",
    description:
      "فقط برای سرور داخل ایران: آدرس Cloudflare Worker (پوشه‌ی telegram-relay/) که تماس‌ها با تلگرام از آن رد می‌شوند، مثل https://telegram-relay.example.workers.dev. اگر تنظیم نشود، اتصال مستقیم به api.telegram.org است. با «حذف مقدار» به حالت مستقیم برمی‌گردد.",
  },
  {
    key: "TELEGRAM_RELAY_SECRET",
    group: "telegram",
    label: "رمز رله‌ی تلگرام",
    description: "همان مقدار RELAY_SECRET که در Worker تنظیم شده؛ در هدر X-Relay-Secret فرستاده می‌شود تا فقط این سرور بتواند از رله استفاده کند.",
  },
] as const;

/** مقدار یک تنظیم را رمزنگاری‌شده ذخیره می‌کند (ایجاد یا به‌روزرسانی). */
export async function setSetting(key: SettingKey, value: string, updatedBy: string): Promise<void> {
  const valueEncrypted = encryptSecret(value);
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, valueEncrypted, updatedBy },
    update: { valueEncrypted, updatedBy },
  });
}

/** مقدار ذخیره‌شده‌ی یک تنظیم را حذف می‌کند تا دوباره مقدار .env (یا رفتار پیش‌فرض) استفاده شود. */
export async function deleteSetting(key: SettingKey): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key } });
}

/**
 * مقدار رمزگشایی‌شده‌ی یک تنظیم را برمی‌گرداند؛ اگر تنظیم نشده باشد null.
 * فقط برای استفاده‌ی داخلی سرور (مثلاً اتصال به درگاه پرداخت واقعی)؛ هرگز به کلاینت ارسال نشود.
 */
export async function getSetting(key: SettingKey): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row) {
    return null;
  }
  return decryptSecret(row.valueEncrypted);
}

export type SettingStatus = {
  key: SettingKey;
  group: string;
  label: string;
  description: string;
  configured: boolean;
  updatedAt: string | null;
  updatedByMobile: string | null;
};

/** وضعیت تمام تنظیمات تعریف‌شده را برمی‌گرداند (تنظیم‌شده/نشده)، بدون مقدار واقعی. */
export async function listSettingStatuses(): Promise<SettingStatus[]> {
  const rows = await prisma.appSetting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const updaterIds = rows.map((r) => r.updatedBy);
  const updaters = updaterIds.length
    ? await prisma.user.findMany({ where: { id: { in: updaterIds } }, select: { id: true, mobile: true } })
    : [];
  const mobileById = new Map(updaters.map((u) => [u.id, u.mobile]));

  return SETTING_DEFS.map((def) => {
    const row = byKey.get(def.key);
    return {
      key: def.key,
      group: def.group,
      label: def.label,
      description: def.description,
      configured: !!row,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedByMobile: row ? (mobileById.get(row.updatedBy) ?? null) : null,
    };
  });
}
