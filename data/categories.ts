// منبع واحد حقیقت برای دسته‌ها، سایت‌ها و قیمت هر جفت (دسته، سایت).
// قیمت مستقیماً per-site است؛ هیچ ضریب سایتی روی آن اعمال نمی‌شود.

/** نام‌های رسمی سایت‌ها — هر جای کد فقط از این‌ها استفاده کند تا نام ناهماهنگ پیش نیاید. */
export const SITES = {
  adobeStock: "Adobe Stock",
  // Freepik به Magnific تغییر نام داده؛ هر دو دامنه پشتیبانی می‌شوند.
  freepik: "Freepik (Magnific)",
  envatoElements: "Envato Elements",
  pikbest: "Pikbest",
  lovepik: "Lovepik",
  designi: "Designi Premium",
  vecteezy: "Vecteezy",
  ui8: "UI8",
  rawpixel: "Rawpixel",
  yellowImages: "Yellow Images",
  shutterstock: "Shutterstock",
  istock: "iStock",
  dreamstime: "Dreamstime",
  depositphotos: "Depositphotos",
  rf123: "123RF",
  vectorstock: "VectorStock",
  pngtree: "PNGTree",
  motionArray: "Motion Array",
  storyblocks: "Storyblocks",
  creativeFabrica: "CreativeFabrica",
  iconscout: "Iconscout",
  flaticon: "Flaticon",
  artlist: "Artlist",
} as const;

export type SiteName = (typeof SITES)[keyof typeof SITES];

export interface Category {
  id: string;
  title: string;
  icon: string;
  /** قیمت هر سایت در این دسته، به ریال (integer). ترتیب کلیدها ترتیب نمایش است. */
  sitePricesRial: Partial<Record<SiteName, number>>;
  sites: SiteName[];
}

const S = SITES;

/** قیمت‌ها در جدول به تومان نوشته می‌شوند و یک‌جا به ریال (×۱۰) تبدیل می‌شوند. */
function defineCategory(
  id: string,
  title: string,
  icon: string,
  pricesToman: [SiteName, number][],
): Category {
  const sitePricesRial: Partial<Record<SiteName, number>> = {};
  for (const [site, toman] of pricesToman) {
    if (!Number.isInteger(toman) || toman <= 0) throw new Error(`قیمت نامعتبر: ${id}/${site}`);
    if (site in sitePricesRial) throw new Error(`سایت تکراری در دسته‌ی ${id}: ${site}`);
    sitePricesRial[site] = toman * 10;
  }
  return { id, title, icon, sitePricesRial, sites: pricesToman.map(([s]) => s) };
}

export const CATEGORIES: Category[] = [
  defineCategory("psd", "فایل لایه‌باز", "🖼️", [
    [S.freepik, 20000], [S.designi, 79000], [S.vecteezy, 69000], [S.adobeStock, 69000],
    [S.envatoElements, 60000], [S.pikbest, 60000], [S.lovepik, 60000],
  ]),
  defineCategory("mockup", "موکاپ", "🎨", [
    [S.envatoElements, 65000], [S.freepik, 20000], [S.adobeStock, 69000], [S.ui8, 170000],
    [S.rawpixel, 95000], [S.yellowImages, 900000],
  ]),
  defineCategory("vector", "وکتور", "✏️", [
    [S.adobeStock, 69000], [S.shutterstock, 75000], [S.freepik, 20000], [S.vecteezy, 69000],
    [S.istock, 95000], [S.dreamstime, 95000], [S.depositphotos, 95000], [S.rf123, 95000],
    [S.vectorstock, 190000], [S.pngtree, 65000],
  ]),
  defineCategory("photo", "عکس باکیفیت", "📷", [
    [S.adobeStock, 69000], [S.shutterstock, 75000], [S.istock, 95000], [S.freepik, 20000],
    [S.vecteezy, 69000], [S.dreamstime, 95000], [S.depositphotos, 95000], [S.rf123, 95000],
  ]),
  defineCategory("png", "PNG بدون بک‌گراند", "🌟", [
    [S.pngtree, 65000], [S.vecteezy, 69000], [S.adobeStock, 69000], [S.designi, 79000],
    [S.creativeFabrica, 60000], [S.iconscout, 65000],
  ]),
  defineCategory("premiere", "پریمیر و افترافکت", "🎞️", [
    [S.envatoElements, 65000], [S.motionArray, 65000], [S.designi, 79000], [S.adobeStock, 69000],
  ]),
  defineCategory("audio", "موزیک و افکت صوتی", "🔊", [
    [S.envatoElements, 65000], [S.artlist, 65000], [S.motionArray, 65000], [S.freepik, 45000],
  ]),
  defineCategory("video", "ویدیو و فوتیج", "🎬", [
    [S.freepik, 45000], [S.envatoElements, 65000], [S.vecteezy, 69000], [S.motionArray, 65000],
    [S.adobeStock, 250000], [S.storyblocks, 170000], [S.shutterstock, 860000],
  ]),
  // Flaticon: فعلاً فقط قیمت تکی (۳۰٬۰۰۰). قیمت پک (۵۵٬۰۰۰) بعداً جدا می‌شود.
  defineCategory("icon", "آیکون و پک آیکون", "⭐", [
    [S.flaticon, 30000], [S.freepik, 20000], [S.iconscout, 65000], [S.ui8, 170000],
  ]),
  defineCategory("ppt", "قالب پاورپوینت", "📊", [
    [S.envatoElements, 65000], [S.ui8, 170000], [S.designi, 79000], [S.pikbest, 65000],
  ]),
  defineCategory("3d", "مدل و آیکون سه‌بعدی", "🧊", [
    [S.adobeStock, 69000], [S.envatoElements, 65000], [S.ui8, 170000], [S.iconscout, 65000],
    [S.freepik, 20000], [S.designi, 69000],
  ]),
  defineCategory("font", "فونت انگلیسی", "🔤", [
    [S.envatoElements, 65000], [S.ui8, 170000], [S.freepik, 20000], [S.creativeFabrica, 75000],
  ]),
  defineCategory("ui", "UI و فیگما", "💠", [[S.ui8, 170000]]),
  defineCategory("wp", "تم وردپرس", "🌐", [[S.envatoElements, 65000]]),
];

export const ALL_SITES: SiteName[] = Array.from(new Set(CATEGORIES.flatMap((c) => c.sites)));

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** نام‌های قدیمی سایت (مثلاً در سبدهای ذخیره‌شده) → نام رسمی فعلی. */
const LEGACY_SITE_NAMES: Record<string, SiteName> = {
  Freepik: S.freepik,
  Envato: S.envatoElements,
};

/** نام سایت را به نام رسمی فعلی تبدیل می‌کند (نام‌های قدیمی هم پذیرفته می‌شوند). */
export function canonicalSiteName(site: string): string {
  return LEGACY_SITE_NAMES[site] ?? site;
}

/** قیمت ریالی یک جفت (دسته، سایت)؛ اگر سایت در آن دسته نباشد undefined. */
export function sitePriceRial(categoryId: string, site: string): number | undefined {
  const cat = categoryById(categoryId);
  if (!cat || !categoryHasSite(cat, site)) return undefined;
  return cat.sitePricesRial[canonicalSiteName(site) as SiteName];
}

// نگاشت کلیدواژه‌ی دامنه به نام رسمی سایت، برای تشخیص سایت از روی لینک.
// ترتیب مهم است: کلیدهای خاص‌تر قبل از کلیدهای عمومی‌تر.
export const SITE_KEYS: Record<string, SiteName> = {
  envato: S.envatoElements, // elements.envato.com و envato.com همه یک سایت‌اند
  freepik: S.freepik, magnific: S.freepik, "stock.adobe": S.adobeStock, adobe: S.adobeStock,
  shutterstock: S.shutterstock, vecteezy: S.vecteezy, motionarray: S.motionArray,
  pngtree: S.pngtree, flaticon: S.flaticon, iconscout: S.iconscout, ui8: S.ui8,
  pikbest: S.pikbest, "123rf": S.rf123, istock: S.istock, dreamstime: S.dreamstime,
  artlist: S.artlist, storyblocks: S.storyblocks, lovepik: S.lovepik, rawpixel: S.rawpixel,
  creativefabrica: S.creativeFabrica, depositphotos: S.depositphotos,
  vectorstock: S.vectorstock, yellowimages: S.yellowImages, designi: S.designi,
};

// نام دامنه‌ی واقعی بعضی سایت‌ها با کلید SITE_KEYS یکی نیست (مثلاً istockphoto.com برای istock).
// تشخیص سایت فقط روی «نام دامنه‌ی ثبت‌شده» انجام می‌شود، نه هر جای لینک؛ پس این نام‌ها باید اینجا بیایند.
export const SITE_KEY_ALIASES: Record<string, string[]> = {
  istock: ["istockphoto"],
};

// بررسی یکدستی: هر سایتِ دارای قیمت باید با SITE_KEYS قابل تشخیص باشد.
{
  const detectable = new Set(Object.values(SITE_KEYS));
  for (const site of ALL_SITES) {
    if (!detectable.has(site)) throw new Error(`سایت ${site} در SITE_KEYS نیست`);
  }
}

/** آیا این سایت (نام دلخواه، مثلاً از ورودی کاربر) در این دسته پشتیبانی می‌شود؟ */
export function categoryHasSite(cat: Category, site: string): boolean {
  return Object.prototype.hasOwnProperty.call(cat.sitePricesRial, canonicalSiteName(site));
}
