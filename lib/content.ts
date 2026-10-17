// دسترسی به محتوای ساختاریافته‌ی سایت (متن هیرو، تماس با ما، فوتر، منوی هدر).
//
// برخلاف AppSetting، این مقادیر حساس نیستند و رمزنگاری نمی‌شوند. برای هر کلید یک
// مقدار پیش‌فرض (همان متن فعلی سایت) در CONTENT_DEFS تعریف شده تا اگر ادمین چیزی
// تنظیم نکرد، سایت هیچ‌وقت خالی نماند.

import { prisma } from "./db";

export type ContentKey = (typeof CONTENT_DEFS)[number]["key"];

export const CONTENT_DEFS = [
  // هیرو
  { key: "hero.eyebrow", group: "hero", label: "متن نوار بالای عنوان", defaultValue: "بدون خرید اشتراک گران • فقط همان فایلی که می‌خواهی" },
  { key: "hero.title_line1", group: "hero", label: "عنوان اصلی - خط اول", defaultValue: "هر فایلی از هر سایت استوک،" },
  { key: "hero.title_line2", group: "hero", label: "عنوان اصلی - خط دوم (رنگی)", defaultValue: "فقط با یک لینک" },
  { key: "hero.subtitle", group: "hero", label: "زیرعنوان", defaultValue: "لینکش را بفرست، ما دانلود می‌کنیم و تحویلت می‌دهیم — با هزینه‌ای جزئی به ریال، سریع و بی‌دردسر." },
  { key: "hero.button_primary", group: "hero", label: "متن دکمه‌ی اول", defaultValue: "مرور دسته‌ها" },
  { key: "hero.button_secondary", group: "hero", label: "متن دکمه‌ی دوم", defaultValue: "چطور کار می‌کند؟" },

  // تماس با ما
  { key: "contact.phone", group: "contact", label: "شماره تلفن", defaultValue: "" },
  { key: "contact.email", group: "contact", label: "ایمیل", defaultValue: "" },
  { key: "contact.address", group: "contact", label: "آدرس", defaultValue: "" },
  { key: "contact.telegram", group: "contact", label: "آیدی تلگرام پشتیبانی", defaultValue: "" },
  { key: "contact.hours", group: "contact", label: "ساعات کاری", defaultValue: "" },
  { key: "contact.description", group: "contact", label: "متن توضیحی تماس با ما", defaultValue: "" },

  // مشخصات حقوقی کسب‌وکار (فقط آنچه واقعاً دارید وارد کنید؛ خالی = نمایش داده نمی‌شود)
  { key: "legal.business_name", group: "legal", label: "نام حقوقی / نام ثبت‌شده‌ی کسب‌وکار", defaultValue: "" },
  { key: "legal.business_id", group: "legal", label: "شناسه‌ی ثبت یا کد اقتصادی/ملی (در صورت وجود)", defaultValue: "" },

  // فوتر
  { key: "footer.tagline", group: "footer", label: "توضیح کوتاه برند", defaultValue: "سرویس دانلود تک‌فایل از پلتفرم‌های استوک" },
  { key: "footer.copyright", group: "footer", label: "پانوشت اختیاری (خالی = فقط © نام کسب‌وکار)", defaultValue: "" },
  { key: "footer.social_instagram", group: "footer", label: "لینک اینستاگرام", defaultValue: "" },
  { key: "footer.social_telegram", group: "footer", label: "لینک تلگرام", defaultValue: "" },
  // نماد اعتماد الکترونیکی (اینماد): فقط شناسه و کد؛ تگ نهایی در کد ساخته می‌شود (HTML خام از ادمین پذیرفته نمی‌شود).
  { key: "footer.enamad_id", group: "footer", label: "نماد اعتماد (اینماد) - شناسه (id)", defaultValue: "8047067" },
  { key: "footer.enamad_code", group: "footer", label: "نماد اعتماد (اینماد) - کد (Code)", defaultValue: "uU8k4kixIIjIr2gRXVBDvonZfTv9E5Eb" },

  // هدر - آیتم‌های منو (هر آیتم به‌صورت کلید جدا: متن و لینک)
  { key: "header.nav1_label", group: "header", label: "منو ۱ - متن", defaultValue: "چطور کار می‌کند" },
  { key: "header.nav1_href", group: "header", label: "منو ۱ - لینک", defaultValue: "#how" },
  { key: "header.nav2_label", group: "header", label: "منو ۲ - متن", defaultValue: "دسته‌ها" },
  { key: "header.nav2_href", group: "header", label: "منو ۲ - لینک", defaultValue: "#cats" },
  { key: "header.nav3_label", group: "header", label: "منو ۳ - متن", defaultValue: "کیف پول" },
  { key: "header.nav3_href", group: "header", label: "منو ۳ - لینک", defaultValue: "#wallet" },
  { key: "header.nav4_label", group: "header", label: "منو ۴ - متن", defaultValue: "همکاری در فروش" },
  { key: "header.nav4_href", group: "header", label: "منو ۴ - لینک", defaultValue: "/affiliate" },
  { key: "header.nav5_label", group: "header", label: "منو ۵ - متن", defaultValue: "قیمت‌ها" },
  { key: "header.nav5_href", group: "header", label: "منو ۵ - لینک", defaultValue: "/pricing" },

  // سئو: کد تأیید مالکیت Google Search Console (فقط مقدار content متا تگ؛ رمز نیست)
  { key: "seo.google_verification", group: "seo", label: "کد تأیید Google Search Console (فقط مقدار content متا تگ، نه کل تگ)", defaultValue: "" },

  // معرفی همکاری در فروش در صفحه‌ی اصلی (درصد و حداقل تسویه از تنظیمات مالی خوانده می‌شوند)
  { key: "affiliate.title", group: "affiliate", label: "عنوان بخش", defaultValue: "با معرفی گت‌استوک درآمد داشته باش" },
  { key: "affiliate.subtitle", group: "affiliate", label: "توضیح بخش", defaultValue: "لینک اختصاصی‌ات را با دوستان، شاگردها یا مخاطبانت به اشتراک بگذار؛ از هر سفارشی که ثبت کنند سهم می‌گیری — بدون سرمایه و بدون پشتیبانی از مشتری." },
  { key: "affiliate.button", group: "affiliate", label: "متن دکمه", defaultValue: "شروع همکاری" },
] as const;

const DEFAULTS_BY_KEY: Record<string, string> = Object.fromEntries(
  CONTENT_DEFS.map((d) => [d.key, d.defaultValue])
);

/** مقدار یک فیلد محتوا را ذخیره می‌کند (ایجاد یا به‌روزرسانی). */
export async function setContent(key: ContentKey, value: string, updatedBy: string): Promise<void> {
  await prisma.siteContent.upsert({
    where: { key },
    create: { key, value, updatedBy },
    update: { value, updatedBy },
  });
}

/** مقدار یک فیلد محتوا را برمی‌گرداند؛ اگر تنظیم نشده بود مقدار پیش‌فرض. */
export async function getContent(key: ContentKey): Promise<string> {
  const row = await prisma.siteContent.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS_BY_KEY[key] ?? "";
}

/** تمام محتوای سایت را یکجا برمی‌گرداند (کلید → مقدار)؛ برای رندر سمت سرور صفحه‌ی اصلی. */
export async function getAllContent(): Promise<Record<string, string>> {
  const rows = await prisma.siteContent.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(CONTENT_DEFS.map((d) => [d.key, byKey.get(d.key) ?? d.defaultValue]));
}

export type ContentRow = {
  key: ContentKey;
  group: string;
  label: string;
  value: string;
  isDefault: boolean;
  updatedAt: string | null;
  updatedByMobile: string | null;
};

/** تمام فیلدهای محتوا را همراه با مقدار فعلی (تنظیم‌شده یا پیش‌فرض) برای پنل ادمین برمی‌گرداند. */
export async function listContentRows(): Promise<ContentRow[]> {
  const rows = await prisma.siteContent.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const updaterIds = rows.map((r) => r.updatedBy);
  const updaters = updaterIds.length
    ? await prisma.user.findMany({ where: { id: { in: updaterIds } }, select: { id: true, mobile: true } })
    : [];
  const mobileById = new Map(updaters.map((u) => [u.id, u.mobile]));

  return CONTENT_DEFS.map((def) => {
    const row = byKey.get(def.key);
    return {
      key: def.key,
      group: def.group,
      label: def.label,
      value: row?.value ?? def.defaultValue,
      isDefault: !row,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedByMobile: row ? (mobileById.get(row.updatedBy) ?? null) : null,
    };
  });
}
