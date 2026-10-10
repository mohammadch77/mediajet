// ثابت‌های حقوقی: نسخه‌ی متن قوانین (برای ثبت اینکه کاربر کدام نسخه را پذیرفته) و آدرس صفحه‌ها.
// با هر تغییر محتوایی در صفحه‌های قوانین/حریم خصوصی/بازگشت وجه، LEGAL_VERSION را عوض کن.

export const LEGAL_VERSION = "2026-10-10";

export const LEGAL_LINKS = {
  terms: { href: "/terms", label: "قوانین و مقررات" },
  privacy: { href: "/privacy", label: "حریم خصوصی" },
  cookies: { href: "/cookies", label: "سیاست کوکی" },
  refund: { href: "/refund", label: "شرایط بازگشت وجه" },
} as const;

/** متن قدیمی «ماکاپ اولیه» که پیش‌تر پیش‌فرض پانوشت بود؛ اگر هنوز در دیتابیس مانده باشد نمایش داده نمی‌شود. */
export const LEGACY_FOOTER_PLACEHOLDER_PREFIX = "این یک ماکاپ اولیه است";

/** پانوشت قابل نمایش: متن ادمین، مگر متن قدیمیِ جای‌نگهدار که حذف می‌شود. */
export function visibleFooterNote(raw: string | undefined): string {
  const text = (raw ?? "").trim();
  return text.startsWith(LEGACY_FOOTER_PLACEHOLDER_PREFIX) ? "" : text;
}

/** سال شمسی جاری (برای © پیش‌فرض) بدون وابستگی اضافه. */
export function currentJalaliYear(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(now);
}
