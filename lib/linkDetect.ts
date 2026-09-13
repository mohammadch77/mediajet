import { CATEGORIES, CATEGORY_URL_PATTERNS, ALL_SITES, type Category } from "@/data/categories";
import { detectSite } from "./detectSite";

export interface LinkDetection {
  supported: boolean;
  site: string;
  /** دسته‌ای که از روی الگوی URL حدس زده شد؛ اگر مبهم بود null است و کاربر باید خودش انتخاب کند. */
  categoryId: string | null;
  /** دسته‌هایی که این سایت اصلاً در آن‌ها پشتیبانی می‌شود (برای انتخاب دستی وقتی categoryId مشخص نیست). */
  candidates: Category[];
}

/** لینک ورودی برای بازکردن مستقیم دراور روی نتیجه‌ی تشخیص (سایت + دسته/کاندیدها). */
export interface LinkEntry {
  link: string;
  site: string;
  categoryId: string | null;
  candidates: Category[];
}

export function unsupportedSiteMessage(): string {
  return `این سایت فعلاً پشتیبانی نمی‌شود. سایت‌های پشتیبانی‌شده: ${ALL_SITES.join("، ")}`;
}

/**
 * تشخیص سایت و (در صورت امکان) دسته‌ی محصول از روی یک لینک.
 * تشخیص دسته صرفاً بر اساس الگوی مسیر URL است و برای همه‌ی لینک‌ها جواب نمی‌دهد؛
 * وقتی الگو با هیچ‌کدام از دسته‌های آن سایت مطابقت نداشت، categoryId برابر null برمی‌گردد
 * و باید از میان candidates به‌صورت دستی انتخاب شود.
 */
export function detectFromLink(url: string): LinkDetection {
  const site = detectSite(url);
  if (!site) {
    return { supported: false, site: "", categoryId: null, candidates: [] };
  }

  const candidates = CATEGORIES.filter((c) => c.sites.includes(site));
  const low = url.toLowerCase();
  let categoryId: string | null = null;
  for (const { pattern, categoryId: id } of CATEGORY_URL_PATTERNS) {
    if (pattern.test(low) && candidates.some((c) => c.id === id)) {
      categoryId = id;
      break;
    }
  }

  return { supported: true, site, categoryId, candidates };
}
