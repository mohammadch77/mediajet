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
