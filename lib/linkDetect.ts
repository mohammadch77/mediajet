import { CATEGORIES, categoryHasSite, type Category } from "@/data/categories";
import { detectSite } from "./detectSite";
import { unsupportedSiteMessage } from "./productUrl";

export { unsupportedSiteMessage };

export interface LinkDetection {
  supported: boolean;
  site: string;
  /** دسته‌هایی که این سایت در آن‌ها پشتیبانی می‌شود — همیشه باید از کاربر پرسیده شود. */
  candidates: Category[];
}

/** لینک ورودی برای بازکردن مستقیم دراور روی نتیجه‌ی تشخیص سایت. */
export interface LinkEntry {
  link: string;
  site: string;
  candidates: Category[];
}

/** ورودی دراور وقتی کاربر از روی کارتِ یک سایت مشخص شروع می‌کند (لینک هنوز خالی است). */
export function sitePresetEntry(site: string): LinkEntry {
  return { link: "", site, candidates: CATEGORIES.filter((c) => categoryHasSite(c, site)) };
}

/**
 * تشخیص سایت از روی یک لینک، صرفاً بر اساس دامنه.
 * دسته‌ی محصول همیشه باید از خود کاربر پرسیده شود — از روی URL حدس زده نمی‌شود،
 * چون این حدس برای خیلی از سایت‌ها/لینک‌ها نادرست یا مبهم بود.
 */
export function detectFromLink(url: string): LinkDetection {
  const site = detectSite(url);
  if (!site) {
    return { supported: false, site: "", candidates: [] };
  }

  const candidates = CATEGORIES.filter((c) => categoryHasSite(c, site));
  return { supported: true, site, candidates };
}
