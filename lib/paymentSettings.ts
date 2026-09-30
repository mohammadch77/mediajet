// تنظیمات عددی پرداخت (درصد کارمزد درگاه، درصد کارمزد کیف پول، حداقل مبلغ شارژ کیف پول).
//
// چرا این‌جا و نه lib/settings.ts؟ AppSetting مخصوص مقادیر حساس است و مقدارش
// رمزنگاری می‌شود و هرگز به ادمین برگردانده نمی‌شود — ولی ادمین باید مقدار فعلی این
// درصدها را ببیند تا بتواند ویرایش‌شان کند. پس از همان جدول کلید-مقدارِ غیررمزنگاری‌شده‌ی
// موجود (SiteContent) استفاده می‌کنیم و جدول جدیدی اضافه نمی‌کنیم.
//
// چرا در CONTENT_DEFS (lib/content.ts) اضافه نشدند؟ چون getAllContent() تمام کلیدهای
// CONTENT_DEFS را برای رندر صفحه‌ی اصلی به کلاینت می‌فرستد و درصد کارمزد هرگز نباید به
// UI برسد. این ماژول فقط سمت سرور خوانده می‌شود.
//
// هیچ کشی وجود ندارد: هر فراخوانی مقدار تازه را از دیتابیس می‌خواند تا تغییر ادمین
// بلافاصله روی قیمت بعدی اثر بگذارد.

import { prisma } from "./db";

export type PaymentSettingKey = (typeof PAYMENT_SETTING_DEFS)[number]["key"];

export const PAYMENT_SETTING_DEFS = [
  {
    key: "payment.gateway_surcharge_percent",
    label: "درصد کارمزد پرداخت مستقیم از درگاه",
    description:
      "درصدی که روی قیمت پایه‌ی سفارش اضافه می‌شود وقتی کاربر مستقیم از درگاه پرداخت می‌کند.",
    unit: "درصد",
    defaultValue: 11,
    min: 0,
    max: 100,
  },
  {
    key: "payment.wallet_surcharge_percent",
    label: "درصد کارمزد پرداخت از کیف پول",
    description:
      "درصدی که روی قیمت پایه‌ی سفارش اضافه می‌شود وقتی کاربر از موجودی کیف پول پرداخت می‌کند.",
    unit: "درصد",
    defaultValue: 5,
    min: 0,
    max: 100,
  },
  {
    key: "payment.wallet_min_charge_rial",
    label: "حداقل مبلغ شارژ کیف پول (ریال)",
    description: "کمترین مبلغی که کاربر می‌تواند در یک تراکنش کیف پولش را شارژ کند.",
    unit: "ریال",
    defaultValue: 1_000_000,
    min: 1,
    max: 1_000_000_000,
  },
  {
    key: "affiliate.commission_percent",
    label: "درصد کمیسیون همکاری در فروش",
    description:
      "درصدی از قیمت پایه‌ی سفارشِ پرداخت‌شده‌ی زیرمجموعه که به همکار معرف می‌رسد. شارژ کیف پول کمیسیون ندارد. تغییر آن روی کمیسیون‌های قبلی اثر ندارد.",
    unit: "درصد",
    defaultValue: 5,
    min: 0,
    max: 50,
  },
  {
    key: "affiliate.min_payout_rial",
    label: "حداقل مبلغ تسویه‌ی همکاری (ریال)",
    description: "کمترین موجودی کمیسیون که همکار می‌تواند برای آن درخواست واریز بدهد.",
    unit: "ریال",
    defaultValue: 2_000_000,
    min: 10_000,
    max: 1_000_000_000,
  },
] as const;

const DEF_BY_KEY = new Map(PAYMENT_SETTING_DEFS.map((d) => [d.key as string, d]));

export type PaymentSettings = {
  /** درصد کارمزد پرداخت مستقیم از درگاه (مثلاً ۱۱) */
  gatewaySurchargePercent: number;
  /** درصد کارمزد پرداخت از کیف پول (مثلاً ۵) */
  walletSurchargePercent: number;
  /** حداقل مبلغ شارژ کیف پول، به ریال */
  walletMinChargeRial: bigint;
  /** درصد کمیسیون همکاری در فروش (مثلاً ۵) */
  affiliateCommissionPercent: number;
  /** حداقل مبلغ درخواست تسویه‌ی همکاری، به ریال */
  affiliateMinPayoutRial: bigint;
};

/** مقدار ذخیره‌شده را به عدد تبدیل می‌کند؛ اگر نبود یا خراب بود، مقدار پیش‌فرض. */
function parseValue(key: PaymentSettingKey, raw: string | undefined): number {
  const def = DEF_BY_KEY.get(key)!;
  if (raw === undefined) return def.defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < def.min || parsed > def.max) {
    return def.defaultValue;
  }
  return parsed;
}

/**
 * تمام تنظیمات پرداخت را یکجا و تازه از دیتابیس می‌خواند.
 * فقط سمت سرور؛ خروجی هرگز نباید مستقیماً به کلاینت عمومی ارسال شود.
 */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const rows = await prisma.siteContent.findMany({
    where: { key: { in: PAYMENT_SETTING_DEFS.map((d) => d.key as string) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  return {
    gatewaySurchargePercent: parseValue(
      "payment.gateway_surcharge_percent",
      byKey.get("payment.gateway_surcharge_percent"),
    ),
    walletSurchargePercent: parseValue(
      "payment.wallet_surcharge_percent",
      byKey.get("payment.wallet_surcharge_percent"),
    ),
    walletMinChargeRial: BigInt(
      parseValue("payment.wallet_min_charge_rial", byKey.get("payment.wallet_min_charge_rial")),
    ),
    affiliateCommissionPercent: parseValue(
      "affiliate.commission_percent",
      byKey.get("affiliate.commission_percent"),
    ),
    affiliateMinPayoutRial: BigInt(
      parseValue("affiliate.min_payout_rial", byKey.get("affiliate.min_payout_rial")),
    ),
  };
}

/** مقدار یک تنظیم پرداخت را ذخیره می‌کند (ایجاد یا به‌روزرسانی). */
export async function setPaymentSetting(
  key: PaymentSettingKey,
  value: number,
  updatedBy: string,
): Promise<void> {
  const stored = String(value);
  await prisma.siteContent.upsert({
    where: { key },
    create: { key, value: stored, updatedBy },
    update: { value: stored, updatedBy },
  });
}

export type PaymentSettingRow = {
  key: PaymentSettingKey;
  label: string;
  description: string;
  unit: string;
  value: number;
  isDefault: boolean;
  min: number;
  max: number;
  updatedAt: string | null;
  updatedByMobile: string | null;
};

/** تمام تنظیمات پرداخت را با مقدار فعلی برای پنل ادمین برمی‌گرداند. */
export async function listPaymentSettingRows(): Promise<PaymentSettingRow[]> {
  const rows = await prisma.siteContent.findMany({
    where: { key: { in: PAYMENT_SETTING_DEFS.map((d) => d.key as string) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const updaterIds = rows.map((r) => r.updatedBy);
  const updaters = updaterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: updaterIds } },
        select: { id: true, mobile: true },
      })
    : [];
  const mobileById = new Map(updaters.map((u) => [u.id, u.mobile]));

  return PAYMENT_SETTING_DEFS.map((def) => {
    const row = byKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      unit: def.unit,
      value: parseValue(def.key, row?.value),
      isDefault: !row,
      min: def.min,
      max: def.max,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedByMobile: row ? (mobileById.get(row.updatedBy) ?? null) : null,
    };
  });
}
