import PriceBoard, { type BoardSite } from "@/components/PriceBoard";
import { CATEGORIES, ALL_SITES } from "@/data/categories";
import { siteAccent } from "@/data/siteLogos";
import { toPersianDigits } from "@/lib/money";

/** بازه‌ی قیمت (ریال) → «۲۰٬۰۰۰ تا ۶۰٬۰۰۰ تومان» یا «۷۰٬۰۰۰ تومان» وقتی بازه یک عدد است. */
export function priceRangeLabel(minRial: number, maxRial: number): string {
  const f = (r: number) => toPersianDigits(Math.round(r / 10).toLocaleString("en-US"));
  return minRial === maxRial ? `${f(minRial)} تومان` : `${f(minRial)} تا ${f(maxRial)} تومان`;
}

/** داده را فقط از منبع واحد قیمت (data/categories.ts) می‌سازد و به تابلوی کارتی می‌دهد؛ عدد دستی ندارد. */
export default function PriceTable() {
  const cats = CATEGORIES.map((c) => ({ id: c.id, title: c.title, icon: c.icon }));
  const sites: BoardSite[] = ALL_SITES.map((site) => ({
    site,
    accent: siteAccent(site),
    prices: CATEGORIES.flatMap((c) => {
      const p = c.sitePricesRial[site];
      return typeof p === "number" ? [{ catId: c.id, rial: p }] : [];
    }),
  }));
  return <PriceBoard cats={cats} sites={sites} />;
}
