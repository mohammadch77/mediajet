// منبع واحد حقیقت برای دسته‌ها، سایت‌ها و قیمت پایه (به ریال).
// قیمت‌ها نمونه‌اند و باید با نرخ واقعی به‌روز شوند.

export interface Category {
  id: string;
  title: string;
  icon: string;
  basePriceRial: number;
  sites: string[];
}

export const CATEGORIES: Category[] = [
  { id: "psd", title: "فایل لایه‌باز", icon: "🖼️", basePriceRial: 900000, sites: ["Adobe Stock", "Freepik", "Envato", "Pikbest", "Lovepik"] },
  { id: "mockup", title: "موکاپ", icon: "🎨", basePriceRial: 900000, sites: ["Freepik", "Envato", "Adobe Stock", "UI8", "Rawpixel"] },
  { id: "vector", title: "وکتور", icon: "✏️", basePriceRial: 700000, sites: ["Freepik", "Vecteezy", "Adobe Stock", "Shutterstock", "123RF"] },
  { id: "photo", title: "عکس باکیفیت", icon: "📷", basePriceRial: 700000, sites: ["Freepik", "Adobe Stock", "Shutterstock", "iStock", "Dreamstime"] },
  { id: "png", title: "PNG بدون بک‌گراند", icon: "🌟", basePriceRial: 700000, sites: ["Vecteezy", "PNGTree", "CreativeFabrica", "Iconscout"] },
  { id: "premiere", title: "پریمیر و افترافکت", icon: "🎞️", basePriceRial: 2500000, sites: ["Envato", "Motion Array", "Adobe Stock"] },
  { id: "audio", title: "موزیک و افکت صوتی", icon: "🔊", basePriceRial: 2200000, sites: ["Envato", "Artlist", "Motion Array", "Freepik"] },
  { id: "video", title: "ویدیو و فوتیج", icon: "🎬", basePriceRial: 2500000, sites: ["Freepik", "Vecteezy", "Envato", "Adobe Stock", "Storyblocks"] },
  { id: "icon", title: "آیکون و پک آیکون", icon: "⭐", basePriceRial: 1200000, sites: ["Flaticon", "Freepik", "Iconscout", "UI8"] },
  { id: "ppt", title: "قالب پاورپوینت", icon: "📊", basePriceRial: 1800000, sites: ["Envato", "UI8", "Pikbest"] },
  { id: "3d", title: "مدل و آیکون سه‌بعدی", icon: "🧊", basePriceRial: 2000000, sites: ["Adobe Stock", "Envato", "UI8", "Iconscout"] },
  { id: "font", title: "فونت انگلیسی", icon: "🔤", basePriceRial: 1200000, sites: ["Envato", "UI8", "CreativeFabrica"] },
  { id: "ui", title: "UI و فیگما", icon: "💠", basePriceRial: 1800000, sites: ["UI8"] },
  { id: "wp", title: "تم وردپرس", icon: "🌐", basePriceRial: 1800000, sites: ["Envato Elements"] },
];

export const ALL_SITES: string[] = Array.from(new Set(CATEGORIES.flatMap((c) => c.sites)));

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

// نگاشت کلیدواژه‌ی دامنه به نام سایت، برای تشخیص سایت از روی لینک.
export const SITE_KEYS: Record<string, string> = {
  envato: "Envato", freepik: "Freepik", adobe: "Adobe Stock", shutterstock: "Shutterstock",
  vecteezy: "Vecteezy", motionarray: "Motion Array", pngtree: "PNGTree", flaticon: "Flaticon",
  iconscout: "Iconscout", ui8: "UI8", pikbest: "Pikbest", "123rf": "123RF", istock: "iStock",
  dreamstime: "Dreamstime", artlist: "Artlist", storyblocks: "Storyblocks", lovepik: "Lovepik",
  rawpixel: "Rawpixel", creativefabrica: "CreativeFabrica",
};
