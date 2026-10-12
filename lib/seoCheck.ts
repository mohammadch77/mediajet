// چک‌لیست سئوی یک نوشته/صفحه بر اساس «کلیدواژه‌ی کانونی».
// تابع خالص و بدون وابستگی است: هم در ادمین (زنده، سمت کلاینت) و هم در اسکریپت‌های بررسی استفاده می‌شود.

export type SeoInput = {
  focusKeyword?: string | null;
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  excerpt?: string | null;
  contentHtml: string;
  coverImage?: string | null;
  category?: string | null;
  /** "page" = صفحه‌ی متنی (بدون چک عکس شاخص، دسته و خلاصه). پیش‌فرض: مقاله. */
  kind?: "post" | "page";
};

export type SeoCheck = { id: string; label: string; ok: boolean; hint?: string };

/** یکنواخت‌سازی متن فارسی برای مقایسه: نیم‌فاصله/فاصله، ی/ک عربی، اعراب. */
export function normalizeFa(s: string): string {
  return s
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‏‎]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    n++;
    i += needle.length;
  }
  return n;
}

export function wordCount(html: string): number {
  return htmlToText(html).split(/\s+/).filter(Boolean).length;
}

export function seoChecks(input: SeoInput): SeoCheck[] {
  const kw = normalizeFa(input.focusKeyword ?? "");
  const has = (text?: string | null) => !!kw && normalizeFa(text ?? "").includes(kw);
  const html = input.contentHtml || "";
  const text = htmlToText(html);
  const firstParagraph = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "").trim();
  const h2s = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map((m) => htmlToText(m[1]));
  const metaTitle = (input.metaTitle ?? "").trim();
  const metaDesc = (input.metaDescription ?? "").trim();
  const words = wordCount(html);
  const hrefs = Array.from(html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)).map((m) => m[1]);
  const internal = hrefs.filter((h) => h.startsWith("/") || h.includes("getstock.ir")).length;
  const external = hrefs.filter((h) => /^https?:\/\//.test(h) && !h.includes("getstock.ir")).length;
  const density = kw ? countOccurrences(normalizeFa(text), kw) : 0;

  const withKw = (id: string, label: string, ok: boolean, hint: string): SeoCheck => ({ id, label, ok, hint: ok ? undefined : hint });

  const isPage = input.kind === "page";
  const all: SeoCheck[] = [
    { id: "kw", label: "کلیدواژه‌ی کانونی تعیین شده", ok: !!kw, hint: kw ? undefined : "یک عبارت ۲ تا ۴ کلمه‌ای که می‌خواهی با آن در گوگل دیده شوی بنویس." },
    withKw("kw-title", "کلیدواژه در عنوان مقاله", has(input.title), "کلیدواژه را (بهتر است نزدیک ابتدا) در عنوان بیاور."),
    withKw("kw-metatitle", "کلیدواژه در عنوان سئو (متا تایتل)", has(metaTitle), "کلیدواژه را در عنوان سئو بیاور."),
    withKw("kw-metadesc", "کلیدواژه در توضیحات متا", has(metaDesc), "کلیدواژه را به‌طور طبیعی در توضیحات متا بیاور."),
    withKw("kw-excerpt", "کلیدواژه در خلاصه‌ی مقاله", has(input.excerpt), "خلاصه را طوری بنویس که کلیدواژه در آن باشد."),
    withKw("kw-intro", "کلیدواژه در پاراگراف اول", has(firstParagraph), "کلیدواژه را در همان پاراگراف اول متن بیاور."),
    withKw("kw-h2", "کلیدواژه در دست‌کم یکی از سرتیترهای h2", h2s.some((h) => has(h)), "یکی از سرتیترها را با کلیدواژه (یا شکل نزدیک آن) بنویس."),
    withKw("kw-density", "کلیدواژه دست‌کم ۳ بار در متن", density >= 3, `الان ${density} بار آمده؛ بدون تکرار مصنوعی، به ۳ تا ۸ بار برسان.`),
    { id: "len-metatitle", label: "طول عنوان سئو بین ۳۰ تا ۶۵ نویسه", ok: metaTitle.length >= 30 && metaTitle.length <= 65, hint: `الان ${metaTitle.length} نویسه است.` },
    { id: "len-metadesc", label: "طول توضیحات متا بین ۱۰۰ تا ۱۶۰ نویسه", ok: metaDesc.length >= 100 && metaDesc.length <= 160, hint: `الان ${metaDesc.length} نویسه است.` },
    { id: "words", label: "دست‌کم ۱۰۰۰ کلمه", ok: words >= 1000, hint: `الان ${words} کلمه است.` },
    { id: "h2", label: "دست‌کم ۴ سرتیتر h2", ok: h2s.length >= 4, hint: `الان ${h2s.length} سرتیتر دارد.` },
    { id: "internal", label: "دست‌کم ۳ لینک داخلی", ok: internal >= 3, hint: `الان ${internal} لینک داخلی دارد (به صفحه‌های سایت یا مقاله‌های دیگر لینک بده).` },
    { id: "external", label: "دست‌کم ۱ لینک خارجی معتبر", ok: external >= 1, hint: "یک لینک به منبع معتبر (مثلاً ویکی‌پدیا یا سایت رسمی) بگذار." },
    { id: "cover", label: "عکس شاخص دارد", ok: !!(input.coverImage ?? "").trim(), hint: "آدرس عکس شاخص را وارد کن." },
    { id: "category", label: "دسته‌ی موضوعی انتخاب شده", ok: !!(input.category ?? "").trim(), hint: "برای ساختار سایت و مقاله‌های مرتبط، دسته انتخاب کن." },
  ];
  return isPage ? all.filter((c) => !["kw-excerpt", "cover", "category", "words", "h2"].includes(c.id)) : all;
}

export function seoScore(checks: SeoCheck[]): { passed: number; total: number; percent: number } {
  const passed = checks.filter((c) => c.ok).length;
  return { passed, total: checks.length, percent: Math.round((passed / checks.length) * 100) };
}
