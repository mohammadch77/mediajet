"use client";
import { useMemo, useState } from "react";
import SiteLogo from "@/components/SiteLogo";
import { toPersianDigits } from "@/lib/money";

export type BoardCat = { id: string; title: string; icon: string };
export type BoardSite = { site: string; accent: string; prices: { catId: string; rial: number }[] };

const fmt = (rial: number) => toPersianDigits(Math.round(rial / 10).toLocaleString("en-US"));

/**
 * تابلوی قیمت: فیلتر دسته + کارت رنگیِ هر سایت (لوگو، دسته‌ها، بازه‌ی قیمت).
 * با «همه» بازه‌ی قیمت هر سایت دیده می‌شود؛ با انتخاب یک دسته، قیمت دقیق همان دسته.
 * همه‌ی عددها از منبع واحد قیمت (data/categories.ts) و از سرور می‌آیند.
 */
export default function PriceBoard({ cats, sites }: { cats: BoardCat[]; sites: BoardSite[] }) {
  const [sel, setSel] = useState<string>("all");
  const titleOf = useMemo(() => new Map(cats.map((c) => [c.id, c.title])), [cats]);

  const rows = useMemo(() => {
    return sites
      .map((s) => {
        const list = sel === "all" ? s.prices : s.prices.filter((p) => p.catId === sel);
        if (!list.length) return null;
        const vals = list.map((p) => p.rial);
        return { ...s, min: Math.min(...vals), max: Math.max(...vals), catIds: s.prices.map((p) => p.catId) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.min - b.min || a.site.localeCompare(b.site));
  }, [sites, sel]);

  const chip = (active: boolean) =>
    "px-3.5 py-1.5 rounded-full text-[.8rem] font-bold border transition cursor-pointer " +
    (active
      ? "bg-gradient-to-r from-primary to-primary-deep text-on-solid border-transparent"
      : "text-dim border-[rgb(var(--c-primary2)/.25)] hover:text-text hover:border-[rgb(var(--c-primary2)/.5)]");

  return (
    <div className="!mt-4">
      <div role="group" aria-label="فیلتر دسته" className="flex flex-wrap gap-2 mb-5">
        <button type="button" aria-pressed={sel === "all"} onClick={() => setSel("all")} className={chip(sel === "all")}>همه</button>
        {cats.map((c) => (
          <button key={c.id} type="button" aria-pressed={sel === c.id} onClick={() => setSel(c.id)} className={chip(sel === c.id)}>
            <span aria-hidden className="ml-1">{c.icon}</span>{c.title}
          </button>
        ))}
      </div>

      <div className="hidden md:grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(13rem,.9fr)] gap-6 px-7 pb-3 text-[.8rem] font-bold text-dim">
        <span>سایت مبدأ</span>
        <span>{sel === "all" ? "دسته‌های قابل سفارش" : "دسته"}</span>
        <span className="text-primary">قیمت گت‌استوک</span>
      </div>

      <ul role="list" aria-live="polite" className="m-0 p-0 list-none grid gap-3">
        {rows.map((r) => (
          <li
            key={r.site}
            style={{ ["--a" as string]: r.accent }}
            className="grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(13rem,.9fr)] gap-x-6 gap-y-3 items-center rounded-[26px] p-4 md:px-7 md:py-5 border border-[color-mix(in_srgb,var(--a)_30%,transparent)] bg-[color-mix(in_srgb,var(--a)_11%,rgb(var(--c-surface)))] transition hover:border-[color-mix(in_srgb,var(--a)_60%,transparent)] hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-4 min-w-0">
              <SiteLogo site={r.site} className="h-14 w-14 md:h-[68px] md:w-[68px] rounded-[18px] text-[.9rem] shadow-[0_8px_24px_-10px_rgba(0,0,0,.6)]" />
              <div className="min-w-0">
                <div className="latin font-bold text-text text-[1.05rem] md:text-[1.2rem] break-words" dir="ltr">{r.site}</div>
                <div className="text-[.78rem] mt-0.5 font-bold text-[color-mix(in_srgb,var(--a)_65%,rgb(var(--c-text)))]">
                  {toPersianDigits(r.catIds.length)} دسته قابل سفارش
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 md:border-r md:border-[rgb(var(--c-ov)/.14)] md:pr-6 md:min-h-[44px] md:items-center">
              {(sel === "all" ? r.catIds : [sel]).map((id) => (
                <span key={id} className="px-2.5 py-0.5 rounded-full text-[.72rem] text-dim border border-[rgb(var(--c-ov)/.16)] bg-[rgb(var(--c-ov)/.04)]">
                  {titleOf.get(id)}
                </span>
              ))}
            </div>

            <div className="md:border-r md:border-[rgb(var(--c-ov)/.14)] md:pr-6 text-[color-mix(in_srgb,var(--a)_62%,rgb(var(--c-text)))]">
              <div className="font-display font-extrabold text-[1.15rem] md:text-[1.3rem] leading-[1.5] whitespace-nowrap">
                {r.min === r.max ? (
                  <>{fmt(r.min)} <span className="text-[.8em]">تومان</span></>
                ) : (
                  <>{fmt(r.min)} <span className="text-[.7em] opacity-80">تا</span> {fmt(r.max)} <span className="text-[.8em]">تومان</span></>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
