import SiteLogo from "@/components/SiteLogo";
import { CATEGORIES, ALL_SITES, type SiteName } from "@/data/categories";
import { toPersianDigits } from "@/lib/money";

/** بازه‌ی قیمت (ریال) → «۲۰٬۰۰۰ تا ۶۰٬۰۰۰ تومان» یا «۷۰٬۰۰۰ تومان» وقتی بازه یک عدد است. */
export function priceRangeLabel(minRial: number, maxRial: number): string {
  const f = (r: number) => toPersianDigits(Math.round(r / 10).toLocaleString("en-US"));
  return minRial === maxRial ? `${f(minRial)} تومان` : `${f(minRial)} تا ${f(maxRial)} تومان`;
}

type Row = { site: SiteName; min: number; max: number; cats: string[] };

/** همه‌ی ردیف‌ها از منبع واحد قیمت (data/categories.ts) ساخته می‌شوند؛ عدد دستی ندارد. */
function buildRows(): Row[] {
  return ALL_SITES.map((site) => {
    const entries = CATEGORIES.flatMap((c) => {
      const p = c.sitePricesRial[site];
      return typeof p === "number" ? [{ title: c.title, p }] : [];
    });
    const prices = entries.map((e) => e.p);
    return { site, min: Math.min(...prices), max: Math.max(...prices), cats: entries.map((e) => e.title) };
  }).sort((a, b) => a.min - b.min || a.site.localeCompare(b.site));
}

/** جدول قیمت هر سایت: لوگو، دسته‌هایی که پشتیبانی می‌شود و بازه‌ی قیمت پایه. */
export default function PriceTable() {
  const rows = buildRows();
  return (
    <div className="rounded-2xl border border-[rgb(var(--c-primary2)/.2)] overflow-hidden !mt-4">
      <div className="hidden sm:grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-4 px-5 py-3 text-[.78rem] font-bold text-dim border-b border-[rgb(var(--c-primary2)/.2)] bg-[rgb(var(--c-primary2)/.06)]">
        <span>سایت مبدأ</span>
        <span>دسته‌های قابل سفارش</span>
        <span>بازه‌ی قیمت</span>
      </div>
      <ul className="m-0 p-0 list-none">
        {rows.map((r) => (
          <li
            key={r.site}
            className="grid sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1.5fr)_minmax(12.5rem,.9fr)] gap-x-4 gap-y-2 items-center px-4 sm:px-5 py-3.5 border-b last:border-b-0 border-[rgb(var(--c-primary2)/.12)] odd:bg-[rgb(var(--c-primary2)/.03)]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <SiteLogo site={r.site} className="h-11 w-11 rounded-xl text-[.8rem]" />
              <span className="latin font-bold text-text break-words min-w-0" dir="ltr">{r.site}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.cats.map((t) => (
                <span key={t} className="px-2.5 py-0.5 rounded-full text-[.72rem] text-dim border border-[rgb(var(--c-primary2)/.2)]">{t}</span>
              ))}
            </div>
            <div className="font-display font-extrabold text-cyan text-[.95rem] sm:text-left whitespace-nowrap">{priceRangeLabel(r.min, r.max)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
