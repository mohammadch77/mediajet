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
    description: "کلید سرویس ارسال پیامک برای ارسال کد OTP و اطلاع‌رسانی‌ها.",
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
