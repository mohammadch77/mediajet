"use client";
import { useId, useMemo, useState } from "react";
import SiteLogo from "@/components/SiteLogo";
import { toPersianDigits } from "@/lib/money";

export type BoardCat = { id: string; title: string; icon: string };
export type BoardSite = { site: string; accent: string; prices: { catId: string; rial: number }[] };

const fmt = (rial: number) => toPersianDigits(Math.round(rial / 10).toLocaleString("en-US"));
const MAX_CHIPS = 3;

type SortKey = "cheap" | "pricey" | "name";

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[.75rem] font-bold text-dim mb-1.5">{label}</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none cursor-pointer rounded-2xl border border-[rgb(var(--c-primary2)/.3)] bg-[rgb(var(--c-surface))] text-text font-bold text-[.9rem] pr-4 pl-10 py-3 outline-none transition hover:border-[rgb(var(--c-primary2)/.6)] focus:border-primary"
        >
          {children}
        </select>
        <svg aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </div>
    </div>
  );
}

function SiteCard({ r, sel, titleOf }: { r: { site: string; accent: string; min: number; max: number; catIds: string[] }; sel: string; titleOf: Map<string, string> }) {
  const [open, setOpen] = useState(false);
  const ids = sel === "all" ? r.catIds : [sel];
  const shown = open ? ids : ids.slice(0, MAX_CHIPS);
  const hidden = ids.length - shown.length;
  return (
    <li
      style={{ ["--a" as string]: r.accent }}
      className="group relative flex flex-col overflow-hidden rounded-[28px] border border-[color-mix(in_srgb,var(--a)_28%,transparent)] bg-[color-mix(in_srgb,var(--a)_9%,rgb(var(--c-surface)))] p-5 transition duration-200 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--a)_60%,transparent)] hover:shadow-[0_24px_50px_-28px_var(--a)]"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,transparent,var(--a),transparent)] opacity-80" />
      <span aria-hidden className="pointer-events-none absolute -top-16 -left-16 h-44 w-44 rounded-full bg-[var(--a)] opacity-[.12] blur-3xl" />

      <div className="relative flex items-center gap-3.5 min-w-0">
        <SiteLogo site={r.site} className="h-14 w-14 shrink-0 rounded-[18px] text-[.9rem] shadow-[0_10px_26px_-12px_rgba(0,0,0,.7)] ring-1 ring-[rgb(var(--c-ov)/.15)]" />
        <div className="min-w-0">
          <h3 className="latin m-0 font-bold text-text text-[1.05rem] leading-[1.35] break-words" dir="ltr">{r.site}</h3>
          <div className="text-[.75rem] mt-1 font-bold text-[color-mix(in_srgb,var(--a)_65%,rgb(var(--c-text)))]">
            {toPersianDigits(r.catIds.length)} دسته قابل سفارش
          </div>
        </div>
      </div>

      <div className="relative mt-5 rounded-2xl border border-[rgb(var(--c-ov)/.1)] bg-[rgb(var(--c-sink)/.18)] px-4 py-3.5">
        <div className="text-[.72rem] font-bold text-dim">قیمت گت‌استوک</div>
        <div className="mt-1 font-display font-extrabold leading-[1.4] text-[color-mix(in_srgb,var(--a)_62%,rgb(var(--c-text)))]">
          {r.min === r.max ? (
            <span className="text-[1.5rem]">{fmt(r.min)}</span>
          ) : (
            <span className="text-[1.5rem]">
              {fmt(r.min)} <span className="text-[.85rem] font-bold opacity-75">تا</span> {fmt(r.max)}
            </span>
          )}
          <span className="mr-1.5 text-[.85rem] font-bold">تومان</span>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap content-start gap-1.5 min-h-[2rem]">
        {shown.map((id) => (
          <span key={id} className="px-2.5 py-1 rounded-full text-[.72rem] text-dim border border-[rgb(var(--c-ov)/.16)] bg-[rgb(var(--c-ov)/.04)]">{titleOf.get(id)}</span>
        ))}
        {(hidden > 0 || (open && ids.length > MAX_CHIPS)) && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="px-2.5 py-1 rounded-full text-[.72rem] font-bold cursor-pointer text-[color-mix(in_srgb,var(--a)_65%,rgb(var(--c-text)))] border border-[color-mix(in_srgb,var(--a)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--a)_14%,transparent)]"
          >
            {open ? "کمتر" : `${toPersianDigits(hidden)} دسته‌ی دیگر`}
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * تابلوی قیمت: منوی آبشاری دسته + مرتب‌سازی، و شبکه‌ی کارت‌های هم‌قدِ سایت‌ها (لوگو، قیمت، دسته‌ها).
 * با «همه‌ی دسته‌ها» بازه‌ی قیمت هر سایت دیده می‌شود؛ با انتخاب یک دسته، قیمت دقیق همان دسته.
 * همه‌ی عددها از منبع واحد قیمت (data/categories.ts) و از سرور می‌آیند.
 */
export default function PriceBoard({ cats, sites }: { cats: BoardCat[]; sites: BoardSite[] }) {
  const [sel, setSel] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("cheap");
  const titleOf = useMemo(() => new Map(cats.map((c) => [c.id, c.title])), [cats]);

  const rows = useMemo(() => {
    const list = sites
      .map((s) => {
        const prices = sel === "all" ? s.prices : s.prices.filter((p) => p.catId === sel);
        if (!prices.length) return null;
        const vals = prices.map((p) => p.rial);
        return { site: s.site, accent: s.accent, min: Math.min(...vals), max: Math.max(...vals), catIds: s.prices.map((p) => p.catId) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    list.sort((a, b) =>
      sort === "name" ? a.site.localeCompare(b.site) : sort === "pricey" ? b.max - a.max || a.site.localeCompare(b.site) : a.min - b.min || a.site.localeCompare(b.site),
    );
    return list;
  }, [sites, sel, sort]);

  return (
    <div className="!mt-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3 sm:gap-4 rounded-[24px] border border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 p-4 sm:p-5">
        <Select label="دسته‌ی فایل" value={sel} onChange={setSel}>
          <option value="all">همه‌ی دسته‌ها ({toPersianDigits(cats.length)})</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
          ))}
        </Select>
        <Select label="مرتب‌سازی" value={sort} onChange={(v) => setSort(v as SortKey)}>
          <option value="cheap">ارزان‌ترین</option>
          <option value="pricey">گران‌ترین</option>
          <option value="name">نام سایت (A–Z)</option>
        </Select>
      </div>

      <p className="text-dim text-[.8rem] !mt-3 !mb-4" aria-live="polite">
        {toPersianDigits(rows.length)} سایت{sel === "all" ? "" : ` برای «${titleOf.get(sel)}»`}
      </p>

      <ul role="list" className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-4 items-stretch">
        {rows.map((r) => (
          <SiteCard key={r.site} r={r} sel={sel} titleOf={titleOf} />
        ))}
      </ul>
    </div>
  );
}
