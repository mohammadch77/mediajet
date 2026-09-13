import { categoryById } from "@/data/categories";

// ضریب قیمت بر اساس سایت مبدأ (سایت‌های گران‌تر ضریب بالاتر).
const SITE_MULTIPLIER: Record<string, number> = {
  Shutterstock: 1.3,
  "Adobe Stock": 1.25,
  iStock: 1.2,
  Storyblocks: 1.15,
};

export interface PriceResult {
  categoryId: string;
  site: string;
  basePriceRial: number;
  multiplier: number;
  finalPriceRial: number;
}

/**
 * محاسبه‌ی قیمت فقط سمت سرور. قیمت ارسالی از کلاینت هرگز مبنا نیست.
 * خروجی به ریال و integer است.
 */
export function computePrice(categoryId: string, site: string): PriceResult | null {
  const cat = categoryById(categoryId);
  if (!cat) return null;
  if (!cat.sites.includes(site)) return null;

  const multiplier = SITE_MULTIPLIER[site] ?? 1;
  const finalPriceRial = Math.round(cat.basePriceRial * multiplier);

  return {
    categoryId,
    site,
    basePriceRial: cat.basePriceRial,
    multiplier,
    finalPriceRial,
  };
}
