// اعتبارسنجی لینک محصول: منبع واحد برای سرور (zod) و کلاینت (دراور/صفحه‌ی اصلی).
// مراحل: ۱) پاک‌سازی ورودی کاربر (علامت‌های نامرئی، گیومه، متن اضافه، تایپی scheme)  ۲) پارس و بررسی scheme/پورت
// ۳) تشخیص سایت از «دامنه‌ی کامل» (نه اسم سایت)  ۴) رد صفحه‌های غیرمحصول  ۵) تشخیص نوع فایل از مسیر
// ۶) حذف پارامتر ردیابی و ساخت کلید یکتای فایل (productKey) برای تشخیص سفارش تکراری.
// قواعد هر سایت در data/siteRules.ts است. سرور همیشه مرجع است؛ نسخه‌ی کلاینت فقط برای پیام سریع‌تر است.

import { ALL_SITES, categoryById, categoryHasSite, canonicalSiteName } from "@/data/categories";
import {
  GENERIC_BLOCKED_FIRST,
  SEARCH_LIKE_FIRST,
  SITE_RULES,
  TRACKING_PARAM,
  type SiteRule,
} from "@/data/siteRules";

export const MAX_PRODUCT_URL_LENGTH = 2000;

export interface ProductUrlOk {
  ok: true;
  /** لینک پاک‌شده (https، بدون پورت/hash/پارامتر ردیابی). */
  url: string;
  site: string;
  /** کلید یکتای فایل برای تشخیص سفارش تکراری؛ برای یک فایل با لینک‌های مختلف یکسان است. */
  productKey: string;
  /** شناسه‌ی فایل در سایت مبدأ، اگر از لینک استخراج شد. */
  assetId: string | null;
  /** دسته‌هایی که نوع فایل لینک می‌تواند باشد (خالی = از لینک مشخص نیست). همیشه فقط دسته‌هایی که این سایت می‌فروشد. */
  typeCandidates: string[];
  /** چه چیزی از ورودی کاربر اصلاح شد (برای ثبت/نمایش)؛ مثلاً tracking_removed. */
  notes: string[];
}
export type ProductUrlResult = ProductUrlOk | { ok: false; error: string };

const MSG = {
  empty: "لینک محصول را وارد کن.",
  invalid: "لینک معتبر نیست؛ آدرس کامل صفحه‌ی محصول را با https:// وارد کن.",
  control: "لینک نباید فاصله یا نویسه‌ی کنترلی داشته باشد؛ فقط یک لینک وارد کن.",
  multiple: "در این کادر بیش از یک لینک پیدا شد؛ هر سفارش فقط یک لینک دارد. لینک‌ها را جداگانه ثبت کن.",
  root: "لینک باید به صفحه‌ی یک محصول اشاره کند، نه صفحه‌ی اصلی سایت.",
  notProduct: "این لینک صفحه‌ی خود فایل نیست (مثلاً صفحه‌ی ورود، قیمت، راهنما یا فهرست). روی فایل مورد نظر کلیک کن و لینک همان صفحه را بفرست.",
  search: "این لینک صفحه‌ی جستجو یا مجموعه است و فایل مشخصی ندارد. روی فایل مورد نظر کلیک کن و لینک همان صفحه را بفرست.",
} as const;

export function unsupportedSiteMessage(): string {
  return `این سایت فعلاً پشتیبانی نمی‌شود. سایت‌های پشتیبانی‌شده: ${ALL_SITES.join("، ")}`;
}

// ─── ۱) پاک‌سازی ورودی ───────────────────────────────────────────────────────────────────

// نویسه‌های نامرئی که از کپی تلگرام/واتساپ/صفحه‌ی راست‌به‌چپ می‌آیند (RLM/LRM، فاصله‌ی صفرعرض، BOM، …).
const INVISIBLE = /[\u00ad\u034f\u061c\u180e\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u206f\ufeff]/g;
const LEADING_WRAP = /^[<(\["'«“‘]+/;
const TRAILING_JUNK = /[.,;:!?،؛؟…)\]>}"'»”’]+$/;

function stripWrappers(t: string): string {
  return t.replace(LEADING_WRAP, "").replace(TRAILING_JUNK, "");
}

/** تایپی‌های رایج scheme: «https:/x» و «https//x». */
function fixSchemeTypos(t: string): string {
  return t.replace(/^(https?):\/(?!\/)/i, "$1://").replace(/^(https?)\/\/(?!\/)/i, "$1://");
}

/** تعداد scheme هایی که به متن قبلی چسبیده‌اند (دو لینک چسبیده یا با ویرگول)؛ scheme داخل query (…?u=https://) حساب نمی‌شود. */
function glueCount(t: string): number {
  return (t.match(/(?<![=\/%?&:])https?:\/\//gi) ?? []).length;
}

type Cleaned = { ok: true; text: string; notes: string[] } | { ok: false; error: string };

function cleanInput(raw: string): Cleaned {
  const notes: string[] = [];
  let text = raw.replace(INVISIBLE, "").trim();
  if (text !== raw.trim()) notes.push("invisible_removed");

  if (/\s/.test(text)) {
    // متن اطراف لینک (مثلاً «لینک: https://… لطفاً»): اگر دقیقاً یک لینک داخلش باشد همان را برمی‌داریم.
    const explicit = text.match(/https?:\/\/\S+/gi) ?? [];
    const candidates = (explicit.length > 0
      ? explicit
      : text.split(/\s+/).filter((tok) => /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S/i.test(stripWrappers(tok)))
    ).map(stripWrappers);
    const unique = Array.from(new Set(candidates));
    if (unique.length > 1) return { ok: false, error: MSG.multiple };
    if (unique.length === 0) return { ok: false, error: MSG.control };
    text = unique[0];
    notes.push("text_extracted");
  }

  const before = text;
  text = fixSchemeTypos(stripWrappers(text));
  if (text !== before) notes.push("cleaned");
  if (glueCount(text) > 1) return { ok: false, error: MSG.multiple };
  if (/[\u0000-\u001f\u007f]/.test(text)) return { ok: false, error: MSG.control };
  if (/[<>]/.test(text)) return { ok: false, error: MSG.invalid };
  return { ok: true, text, notes };
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

// ─── ۳) تشخیص سایت از دامنه‌ی کامل ────────────────────────────────────────────────────────

// تنها پیشوندهای مجاز قبل از دامنه‌ی ثبت‌شده: www، m، amp و کد زبان (es، pt-br). بقیه (help.، market.، support.) جداست.
const HOST_PREFIX = /^(www|m|amp|[a-z]{2}(?:-[a-z]{2})?)$/;

interface HostMatch { rule: SiteRule; domain: string }

function matchHost(hostname: string): HostMatch | null {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  for (const rule of SITE_RULES) {
    for (const domain of rule.domains) {
      if (host === domain) return { rule, domain };
      if (host.endsWith(`.${domain}`)) {
        const prefix = host.slice(0, host.length - domain.length - 1);
        if (!prefix.includes(".") && HOST_PREFIX.test(prefix)) return { rule, domain };
      }
    }
  }
  return null;
}

/** سایت رسمی را فقط از روی دامنه‌ی کامل تشخیص می‌دهد؛ "" یعنی دامنه‌ی پشتیبانی‌شده نیست. */
export function matchSiteByHost(hostname: string): string {
  return matchHost(hostname)?.rule.site ?? "";
}

/** تشخیص سبک سایت برای نمایش زنده‌ی UI (بدون خطا و بدون الزام به صفحه‌ی محصول). */
export function detectSiteFromInput(raw: string): string {
  const cleaned = cleanInput(raw);
  const url = cleaned.ok ? parseLoose(cleaned.text) : null;
  return url ? matchSiteByHost(url.hostname) : "";
}

// ─── مسیر، نوع و کلید ───────────────────────────────────────────────────────────────────

// فقط کد زبان‌های شناخته‌شده حذف می‌شود؛ هر بخش دوحرفی دیگر (مثل «so» در pngtree.com/so/…) بخشی از مسیر است.
const LOCALE_CODES = new Set([
  "en", "es", "fr", "de", "it", "pt", "ru", "tr", "ar", "fa", "ja", "ko", "zh", "nl", "pl", "sv", "cs", "da", "fi",
  "no", "nb", "hu", "ro", "th", "vi", "id", "he", "el", "uk", "hi", "bg", "sk", "hr", "sr", "ms", "ca",
]);

function isLocaleSegment(seg: string): boolean {
  const m = /^([a-z]{2})(?:-[a-z]{2,4})?$/i.exec(seg);
  return !!m && LOCALE_CODES.has(m[1].toLowerCase());
}

/** مسیر بدون کد زبان اول (/fr/images/x → images/x). */
function pathAfterLocale(url: URL): string {
  let segs = url.pathname.split("/").filter(Boolean);
  if (segs.length > 0 && isLocaleSegment(segs[0])) segs = segs.slice(1);
  return segs.join("/");
}

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function isBlocked(rule: SiteRule, rest: string): boolean {
  const first = rest.split("/")[0].toLowerCase();
  if (GENERIC_BLOCKED_FIRST.has(first)) return true;
  if (rule.blockedFirst?.some((b) => (typeof b === "string" ? b === first : b.test(first)))) return true;
  return rule.blockedExact?.includes(rest.toLowerCase().replace(/\/+$/, "")) ?? false;
}

function detectTypes(rule: SiteRule, rest: string, url: URL): string[] | null {
  const query = safeDecode(url.search);
  for (const tr of rule.typeRules ?? []) {
    const pathOk = tr.path ? tr.path.test(rest) : true;
    const queryOk = tr.query ? tr.query.test(query) : true;
    if (pathOk && queryOk) return tr.types;
  }
  return null;
}

function extractAssetId(rule: SiteRule, rest: string, url: URL): string | null {
  if (rule.assetParam) {
    const v = url.searchParams.get(rule.assetParam);
    if (v && /^\d{4,}$/.test(v)) return v;
  }
  for (const re of rule.assetId ?? []) {
    const m = re.exec(rest);
    if (m?.[1]) return m[1];
  }
  return null;
}

function stripTracking(url: URL): boolean {
  let removed = false;
  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAM.test(key)) { url.searchParams.delete(key); removed = true; }
  }
  return removed;
}

function fallbackKey(site: string, domain: string, rest: string, url: URL): string {
  const params = Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
  const query = params.map(([k, v]) => `${k}=${v}`).join("&");
  return `${site}|${domain}/${rest.replace(/\/+$/, "")}${query ? `?${query}` : ""}`;
}

/**
 * اعتبارسنجی کامل لینک محصول. اگر claimedSite داده شود (سایتی که کاربر/کلاینت ادعا کرده)، باید با
 * سایتِ واقعیِ دامنه یکی باشد تا قیمت یک سایت ارزان با لینک سایت دیگر ثبت نشود.
 */
export function validateProductUrl(raw: unknown, claimedSite?: string): ProductUrlResult {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: MSG.empty };
  if (raw.trim().length > MAX_PRODUCT_URL_LENGTH) {
    return { ok: false, error: `لینک خیلی طولانی است (حداکثر ${MAX_PRODUCT_URL_LENGTH} نویسه).` };
  }

  const cleaned = cleanInput(raw);
  if (!cleaned.ok) return cleaned;
  const notes = [...cleaned.notes];

  const url = parseLoose(cleaned.text);
  if (!url) return { ok: false, error: MSG.invalid };
  if (url.username || url.password) return { ok: false, error: "لینک نباید نام‌کاربری یا رمز داشته باشد." };
  if (url.port && url.port !== "80" && url.port !== "443") {
    return { ok: false, error: "لینک معتبر نیست (پورت غیرمجاز)." };
  }

  const hit = matchHost(url.hostname);
  if (!hit) return { ok: false, error: unsupportedSiteMessage() };
  const { rule, domain } = hit;
  const site: string = rule.site;

  if (claimedSite !== undefined && canonicalSiteName(claimedSite) !== site) {
    return { ok: false, error: `این لینک مربوط به «${site}» است، نه «${claimedSite}».` };
  }

  // کدگذاری‌شده‌ی نویسه‌ی کنترلی (%00، %0d%0a) در مسیر یا query
  if (/%(?:[01][0-9a-f]|7f)/i.test(url.pathname + url.search)) return { ok: false, error: MSG.invalid };

  const rest = pathAfterLocale(url);
  if (rest === "") return { ok: false, error: MSG.root };

  // صفحه‌ی جستجو/مجموعه: فقط وقتی قبول است که فایل مشخصی (assetParam) داشته باشد (مثل Adobe).
  const first = rest.split("/")[0].toLowerCase();
  const assetId = extractAssetId(rule, rest, url);
  if (SEARCH_LIKE_FIRST.has(first)) {
    if (!(rule.searchNeedsAsset && rule.assetParam && url.searchParams.get(rule.assetParam) && assetId)) {
      return { ok: false, error: MSG.search };
    }
  } else if (isBlocked(rule, rest)) {
    return { ok: false, error: MSG.notProduct };
  }

  // نوع فایل از لینک
  const detected = detectTypes(rule, rest, url);
  if (!detected && rule.strictTypes) return { ok: false, error: rule.strictTypes };
  const typeCandidates = (detected ?? []).filter((id) => {
    const cat = categoryById(id);
    return cat ? categoryHasSite(cat, site) : false;
  });
  if (detected && typeCandidates.length === 0) {
    return { ok: false, error: `این نوع فایل در «${site}» پشتیبانی نمی‌شود.` };
  }

  if (stripTracking(url)) notes.push("tracking_removed");
  url.hash = "";
  url.protocol = "https:";
  url.port = "";

  const productKey = assetId ? `${site}:${assetId}` : fallbackKey(site, domain, rest, url);
  return { ok: true, url: url.href, site, productKey, assetId, typeCandidates, notes };
}
