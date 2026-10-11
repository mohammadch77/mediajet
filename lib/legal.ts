// ثابت‌های حقوقی: نسخه‌ی متن قوانین (برای ثبت اینکه کاربر کدام نسخه را پذیرفته) و آدرس صفحه‌ها.
// با هر تغییر محتوایی در صفحه‌های قوانین/حریم خصوصی/بازگشت وجه، LEGAL_VERSION را عوض کن.

export const LEGAL_VERSION = "2026-10-10";

export const LEGAL_LINKS = {
  terms: { href: "/terms", label: "قوانین و مقررات" },
  privacy: { href: "/privacy", label: "حریم خصوصی" },
  cookies: { href: "/cookies", label: "سیاست کوکی" },
  refund: { href: "/refund", label: "شرایط بازگشت وجه" },
} as const;

/** صفحه‌های معرفی (نه حقوقی)؛ در نوار صفحه‌ها کنار هم نمایش داده می‌شوند. */
export const INFO_LINKS = {
  about: { href: "/about", label: "درباره ما" },
  pricing: { href: "/pricing", label: "قیمت‌ها" },
  faq: { href: "/faq", label: "سؤالات متداول" },
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

/**
 * آیتم‌های منوی بالا (از محتوای ادمین). روی صفحه‌های غیر خانه، لینک‌های #بخش باید به خانه برگردند
 * (مثلاً «#how» ← «/#how»)؛ آدرس‌های کامل و مسیرها دست‌نخورده می‌مانند.
 */
export function headerNavItems(content: Record<string, string>): string[][] {
  return [1, 2, 3, 4, 5]
    .map((n) => [content[`header.nav${n}_href`] ?? "", content[`header.nav${n}_label`] ?? ""])
    .filter(([href, label]) => href && label)
    .map(([href, label]) => [href.startsWith("#") ? `/${href}` : href, label]);
}
