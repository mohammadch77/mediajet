// قواعد تشخیص و اعتبارسنجی لینک هر سایت — منبع واحد برای lib/productUrl.ts.
// ⚠️ قواعد «قطعی» فقط وقتی نوشته شده‌اند که از لینک واقعی تأیید شده باشند (Shutterstock و جستجوی Adobe).
// بقیه‌ی الگوها (شناسه‌ی فایل، نوع) بر اساس شناخت عمومی از ساختار سایت‌هاست و باید با نمونه‌ی واقعی
// بازبینی شوند؛ اگر الگویی با لینک واقعی نخواند، فقط «تشخیص نوع/کلید یکتا» ضعیف می‌شود، لینک رد نمی‌شود.
//
// قاعده‌ی دامنه: «دامنه‌ی کامل با پسوند» (freepik.com، نه فقط freepik). زیردامنه فقط www / m / amp / کد زبان.

import { ALL_SITES, SITES, type SiteName } from "./categories";

const S = SITES;

export interface TypeRule {
  /** روی مسیر (بعد از حذف کد زبان و اسلش اول) آزمایش می‌شود. */
  path?: RegExp;
  /** روی query رمزگشایی‌شده آزمایش می‌شود. */
  query?: RegExp;
  /** شناسه‌ی دسته‌هایی که این نوع فایل می‌تواند باشد (هم‌قیمت‌ها کنار هم). */
  types: string[];
}

export interface SiteRule {
  site: SiteName;
  /** دامنه‌های ثبت‌شده‌ی کامل. */
  domains: string[];
  /** بخش اولِ مسیر که هرگز صفحه‌ی فایل نیست (علاوه بر فهرست عمومی). */
  blockedFirst?: (string | RegExp)[];
  /** مسیرهای کامل که صفحه‌ی فایل نیستند (مثلاً «packs» تنها). */
  blockedExact?: string[];
  /** الگوهای شناسه‌ی فایل روی مسیر؛ گروه ۱ = شناسه. */
  assetId?: RegExp[];
  /** نام پارامتر query که شناسه‌ی فایل را دارد (مثلاً asset_id در جستجوی Adobe). */
  assetParam?: string;
  /** صفحه‌ی جستجو/کلکسیون فقط وقتی قبول است که assetParam داشته باشد. */
  searchNeedsAsset?: boolean;
  /** قواعد تشخیص نوع از روی لینک؛ اولین تطبیق برنده است. */
  typeRules?: TypeRule[];
  /** اگر پر باشد، لینکی که با هیچ typeRule نخواند رد می‌شود (پیام = این متن). */
  strictTypes?: string;
}

/** بخش‌های اولِ مسیر که در هیچ سایتی صفحه‌ی فایل نیستند (فقط تطبیق کامل بخش، نه پیشوند). */
export const GENERIC_BLOCKED_FIRST = new Set([
  "login", "log-in", "signin", "sign-in", "signup", "sign-up", "register", "join",
  "pricing", "plans", "plan", "subscribe", "subscription",
  "blog", "help", "support", "contact", "about", "careers", "press",
  "terms", "privacy", "license", "licenses", "legal", "cookies",
  "cart", "checkout", "account", "downloads",
  "search", "collections", "collection", "contributor", "contributors",
  "home", "index", "index.html", "index.php",
]);

/** بخش‌هایی که صفحه‌ی جستجو/فهرست‌اند (برای پیام راهنمای «لینک خود فایل را بفرست»). */
export const SEARCH_LIKE_FIRST = new Set(["search", "collections", "collection"]);

/** پارامترهای ردیابی که از لینک حذف می‌شوند (معنایی ندارند و لینک یکسان را متفاوت نشان می‌دهند). */
export const TRACKING_PARAM = /^(utm_.+|trackingid|listid|fbclid|gclid|msclkid|igshid|mc_cid|mc_eid|_ga|_gl|ref_src|srsltid)$/i;

const IMG = ["photo", "vector", "png"]; // تصویرهای Adobe همه هم‌قیمت‌اند

export const SITE_RULES: SiteRule[] = [
  {
    site: S.shutterstock,
    domains: ["shutterstock.com"],
    // تأییدشده با لینک واقعی: /video/clip-<id>-<slug> و /image-photo|image-vector/<slug>-<id>
    typeRules: [
      { path: /^video\/clip-\d+/i, types: ["video"] },
      { path: /^image-photo\//i, types: ["photo"] },
      { path: /^image-vector\//i, types: ["vector"] },
      { path: /^image-(illustration|generated)\//i, types: ["vector", "photo"] },
    ],
    strictTypes: "از Shutterstock فقط «عکس»، «وکتور» و «ویدیو» پشتیبانی می‌شود؛ لینک صفحه‌ی خود فایل را بفرست.",
    assetId: [/^video\/clip-(\d+)/i, /-(\d{6,})\/?$/],
  },
  {
    site: S.adobeStock,
    domains: ["stock.adobe.com"],
    // نوع از مسیر جستجو تأییدشده است (/search/video، /search/audio، /search/templates)؛ مسیرهای محصول بازبینی شوند.
    searchNeedsAsset: true,
    assetParam: "asset_id",
    assetId: [/\/(\d{6,})\/?$/],
    typeRules: [
      { query: /content_type(?::|%3a)3d/i, types: ["3d"] },
      { path: /^(search\/)?3d(-assets)?(\/|$)/i, types: ["3d"] },
      { path: /^(search\/)?video(\/|$)/i, types: ["video"] },
      { path: /^(search\/)?audio(\/|$)/i, types: ["audio"] },
      { path: /^(search\/)?templates?(\/|$)/i, types: ["psd", "premiere"] },
      { path: /^(search(\/images)?|images|stock-photo)(\/|$)/i, types: IMG },
    ],
  },
  {
    site: S.freepik,
    domains: ["freepik.com", "magnific.com"],
    blockedFirst: ["author", "authors", "profile", /^popular-/],
    assetId: [/_(\d{4,})(?:\.htm)?\/?$/],
    typeRules: [
      { path: /^(free|premium)-video\//i, types: ["video"] },
      { path: /^(free|premium)-audio\//i, types: ["audio"] },
      { path: /^(free|premium)-vector\//i, types: ["vector"] },
      { path: /^(free|premium)-photo\//i, types: ["photo"] },
      { path: /^(free|premium)-psd\//i, types: ["psd", "mockup"] },
      { path: /^((free|premium)-)?icon\//i, types: ["icon"] },
    ],
  },
  {
    site: S.envatoElements,
    domains: ["elements.envato.com", "envato.com"],
    blockedFirst: ["sign-in", "sign-up", "category", "categories", "discover"],
    assetId: [/-([A-Z0-9]{6,8})\/?$/],
  },
  { site: S.pikbest, domains: ["pikbest.com"], assetId: [/_(\d+)\.html?\/?$/] },
  { site: S.lovepik, domains: ["lovepik.com"], assetId: [/^image-(\d+)\//] },
  { site: S.designi, domains: ["designi.com.br", "designipremium.com"] },
  {
    site: S.vecteezy,
    domains: ["vecteezy.com"],
    blockedFirst: [/^free-/, "stock-footage"],
    assetId: [/\/(\d{4,})-[^/]*$/],
  },
  { site: S.ui8, domains: ["ui8.net"], blockedExact: ["products"], blockedFirst: ["authors"] },
  { site: S.rawpixel, domains: ["rawpixel.com"], assetId: [/^image\/(\d+)/] },
  { site: S.yellowImages, domains: ["yellowimages.com"] },
  {
    site: S.istock,
    domains: ["istockphoto.com", "istock.com"],
    // صفحه‌ی فایل مفرد است (/photo/، /vector/)؛ جمع (/photos/) فهرست است.
    blockedFirst: ["photos", "vectors", "illustrations", "videos", "collaboration"],
    assetId: [/-gm(\d+)-/i],
    typeRules: [
      { path: /^photo\//i, types: ["photo"] },
      { path: /^(vector|illustration)\//i, types: ["vector", "photo"] },
      { path: /^video\//i, types: ["video"] },
    ],
  },
  { site: S.dreamstime, domains: ["dreamstime.com"], blockedFirst: ["free-images"], assetId: [/image(\d+)(?:\/|$)/i] },
  { site: S.depositphotos, domains: ["depositphotos.com"], assetId: [/^(\d{5,})\//] },
  { site: S.rf123, domains: ["123rf.com"], assetId: [/photo_(\d+)_/i] },
  { site: S.vectorstock, domains: ["vectorstock.com"], assetId: [/-(\d+)\/?$/] },
  { site: S.pngtree, domains: ["pngtree.com"], blockedFirst: ["so"], assetId: [/_(\d+)\.html?\/?$/] },
  { site: S.motionArray, domains: ["motionarray.com"], assetId: [/-(\d+)\/?$/] },
  { site: S.storyblocks, domains: ["storyblocks.com"] },
  { site: S.creativeFabrica, domains: ["creativefabrica.com"] },
  { site: S.iconscout, domains: ["iconscout.com"], assetId: [/-(\d+)\/?$/] },
  {
    site: S.flaticon,
    domains: ["flaticon.com"],
    blockedFirst: ["free-icons", "free-stickers", "icons"],
    blockedExact: ["packs"],
    assetId: [/_(\d+)\/?$/],
  },
  { site: S.artlist, domains: ["artlist.io"] },
];

const BY_SITE = new Map<string, SiteRule>(SITE_RULES.map((r) => [r.site, r]));

export function ruleBySite(site: string): SiteRule | undefined {
  return BY_SITE.get(site);
}

// بررسی یکدستی: هر دامنه فقط یک‌بار و هر سایت دارای قیمت باید قاعده داشته باشد.
{
  const seen = new Set<string>();
  for (const r of SITE_RULES) {
    for (const d of r.domains) {
      if (d !== d.toLowerCase() || !d.includes(".")) throw new Error(`دامنه‌ی نامعتبر در SITE_RULES: ${d}`);
      if (seen.has(d)) throw new Error(`دامنه‌ی تکراری در SITE_RULES: ${d}`);
      seen.add(d);
    }
  }
  for (const site of ALL_SITES) {
    if (!BY_SITE.has(site)) throw new Error(`سایت ${site} در SITE_RULES نیست`);
  }
}
