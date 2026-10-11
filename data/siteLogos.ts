import { SITES, type SiteName } from "./categories";

// لوگوی مربعی هر سایت (۱۲۸×۱۲۸، در public/sites). سایتی که این‌جا نیست، با دو حرف اول نامش نمایش داده می‌شود.
// کلیدها از SITES می‌آیند تا با تغییر نام سایت، typecheck ناهماهنگی را بگیرد.
export const SITE_LOGOS: Partial<Record<SiteName, string>> = {
  [SITES.adobeStock]: "/sites/adobe-stock.png",
  [SITES.freepik]: "/sites/freepik-magnific.png",
  [SITES.envatoElements]: "/sites/envato-elements.png",
  [SITES.pikbest]: "/sites/pikbest.png",
  [SITES.lovepik]: "/sites/lovepik.png",
  [SITES.designi]: "/sites/designi.png",
  [SITES.vecteezy]: "/sites/vecteezy.png",
  [SITES.ui8]: "/sites/ui8.png",
  [SITES.rawpixel]: "/sites/rawpixel.png",
  [SITES.yellowImages]: "/sites/yellow-images.png",
  [SITES.shutterstock]: "/sites/shutterstock.png",
  [SITES.istock]: "/sites/istock.png",
  [SITES.dreamstime]: "/sites/dreamstime.png",
  [SITES.depositphotos]: "/sites/depositphotos.png",
  [SITES.rf123]: "/sites/123rf.png",
  [SITES.pngtree]: "/sites/pngtree.png",
  [SITES.motionArray]: "/sites/motion-array.png",
  [SITES.storyblocks]: "/sites/storyblocks.png",
  [SITES.creativeFabrica]: "/sites/creativefabrica.png",
  [SITES.iconscout]: "/sites/iconscout.png",
  [SITES.flaticon]: "/sites/flaticon.png",
  [SITES.artlist]: "/sites/artlist.png",
};

export function siteLogo(site: string): string | undefined {
  return SITE_LOGOS[site as SiteName];
}

/**
 * رنگ شاخص هر سایت برای کارت قیمت (فقط تزئینی؛ از رنگ لوگوی همان سایت). سایتی که این‌جا نیست، رنگ خنثی می‌گیرد.
 */
export const SITE_ACCENTS: Partial<Record<SiteName, string>> = {
  [SITES.adobeStock]: "#6d8cff",
  [SITES.envatoElements]: "#81e04b",
  [SITES.pikbest]: "#f2b035",
  [SITES.lovepik]: "#1aa3f0",
  [SITES.designi]: "#4d8dff",
  [SITES.vecteezy]: "#ff7a00",
  [SITES.ui8]: "#2f8cf0",
  [SITES.yellowImages]: "#ffc800",
  [SITES.shutterstock]: "#ff3b1d",
  [SITES.dreamstime]: "#7bc043",
  [SITES.rf123]: "#f5c518",
  [SITES.vectorstock]: "#7c6cff",
  [SITES.pngtree]: "#8dbb3f",
  [SITES.motionArray]: "#8b8be0",
  [SITES.storyblocks]: "#fdd835",
  [SITES.creativeFabrica]: "#a07bf0",
  [SITES.iconscout]: "#00c0f0",
  [SITES.flaticon]: "#4cd29a",
  [SITES.artlist]: "#e5c94b",
};

export function siteAccent(site: string): string {
  return SITE_ACCENTS[site as SiteName] ?? "#9aa3c7";
}
