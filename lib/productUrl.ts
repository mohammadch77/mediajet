// اعتبارسنجی لینک محصول: منبع واحد برای سرور (zod) و کلاینت (دراور/صفحه‌ی اصلی).
// قواعد: فقط http/https، بدون نام‌کاربری/رمز، پورت عادی، دامنه‌ی ثبت‌شده‌ی یکی از سایت‌های پشتیبانی‌شده
// (نه «هر لینکی که اسم سایت جایی در آن باشد»)، و لینک باید به یک صفحه‌ی محصول اشاره کند نه صفحه‌ی اصلی.
// سرور همیشه مرجع است؛ نسخه‌ی کلاینت فقط برای پیام سریع‌تر به کاربر است.

import { ALL_SITES, SITE_KEYS, SITE_KEY_ALIASES, canonicalSiteName } from "@/data/categories";

export const MAX_PRODUCT_URL_LENGTH = 2000;

export type ProductUrlResult =
  | { ok: true; url: string; site: string }
  | { ok: false; error: string };

// پسوندهای دومرحله‌ای رایج (example.co.uk، designi.com.br) تا نام دامنه‌ی ثبت‌شده درست استخراج شود.
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);

export function unsupportedSiteMessage(): string {
  return `این سایت فعلاً پشتیبانی نمی‌شود. سایت‌های پشتیبانی‌شده: ${ALL_SITES.join("، ")}`;
}

/** رشته‌ی ورودی را به URL تبدیل می‌کند؛ بدون scheme، https فرض می‌شود. null یعنی قابل‌پذیرش نیست. */
function parseLoose(raw: string): URL | null {
  const text = raw.trim();
  if (!text) return null;
  let candidate = text;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    // scheme صریح: فقط http و https
    if (!/^https?:\/\//i.test(text)) return null;
  } else if (/^(javascript|data|vbscript|file|mailto|blob|tel):/i.test(text)) {
    return null;
  } else {
    candidate = `https://${text.replace(/^\/\//, "")}`;
  }
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

/** نام دامنه‌ی ثبت‌شده و برچسب‌های تا همان‌جا، مثلاً elements.envato.com ← [elements, envato]. */
function registrableLabels(hostname: string): string[] {
  const labels = hostname.replace(/\.$/, "").toLowerCase().split(".");
  if (labels.length < 2) return [];
  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];
  const registrableIndex =
    labels.length >= 3 && tld.length === 2 && SECOND_LEVEL.has(sld) ? labels.length - 3 : labels.length - 2;
  return labels.slice(0, registrableIndex + 1);
}

/** سایت رسمی را فقط از روی نام دامنه تشخیص می‌دهد؛ "" یعنی دامنه‌ی پشتیبانی‌شده نیست. */
export function matchSiteByHost(hostname: string): string {
  const base = registrableLabels(hostname);
  if (base.length === 0) return "";
  for (const key in SITE_KEYS) {
    const keyLabels = key.split(".");
    const names = [keyLabels, ...(SITE_KEY_ALIASES[key] ?? []).map((a) => a.split("."))];
    for (const want of names) {
      if (want.length > base.length) continue;
      const tail = base.slice(base.length - want.length);
      if (tail.every((label, i) => label === want[i])) return SITE_KEYS[key];
    }
  }
  return "";
}

/** تشخیص سبک سایت برای نمایش زنده‌ی UI (بدون خطا و بدون الزام به صفحه‌ی محصول). */
export function detectSiteFromInput(raw: string): string {
  const url = parseLoose(raw);
  return url ? matchSiteByHost(url.hostname) : "";
}

/**
 * اعتبارسنجی کامل لینک محصول. اگر claimedSite داده شود (سایتی که کاربر/کلاینت ادعا کرده)، باید با
 * سایتِ واقعیِ دامنه یکی باشد تا قیمت یک سایت ارزان با لینک سایت دیگر ثبت نشود.
 */
export function validateProductUrl(raw: unknown, claimedSite?: string): ProductUrlResult {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "لینک محصول را وارد کن." };
  const text = raw.trim();
  if (text.length > MAX_PRODUCT_URL_LENGTH) {
    return { ok: false, error: `لینک خیلی طولانی است (حداکثر ${MAX_PRODUCT_URL_LENGTH} نویسه).` };
  }
  if (/[\s\u0000-\u001f\u007f]/.test(text)) {
    return { ok: false, error: "لینک نباید فاصله یا نویسه‌ی کنترلی داشته باشد؛ فقط یک لینک وارد کن." };
  }

  const url = parseLoose(text);
  if (!url) {
    return { ok: false, error: "لینک معتبر نیست؛ آدرس کامل صفحه‌ی محصول را با https:// وارد کن." };
  }
  if (url.username || url.password) return { ok: false, error: "لینک نباید نام‌کاربری یا رمز داشته باشد." };
  if (url.port && url.port !== "80" && url.port !== "443") {
    return { ok: false, error: "لینک معتبر نیست (پورت غیرمجاز)." };
  }

  const site = matchSiteByHost(url.hostname);
  if (!site) return { ok: false, error: unsupportedSiteMessage() };

  if (claimedSite !== undefined && canonicalSiteName(claimedSite) !== site) {
    return { ok: false, error: `این لینک مربوط به «${site}» است، نه «${claimedSite}».` };
  }

  if (url.pathname.replace(/\/+$/, "") === "") {
    return { ok: false, error: "لینک باید به صفحه‌ی یک محصول اشاره کند، نه صفحه‌ی اصلی سایت." };
  }

  url.hash = "";
  url.protocol = "https:";
  url.port = "";
  return { ok: true, url: url.href, site };
}
