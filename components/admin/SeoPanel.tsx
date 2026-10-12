"use client";
import { seoChecks, seoScore, type SeoInput } from "@/lib/seoCheck";

/**
 * پیش‌نمایش گوگل + چک‌لیست زنده‌ی سئو بر اساس کلیدواژه‌ی کانونی.
 * هم در ویرایشگر مقاله و هم در ویرایشگر صفحه‌ها استفاده می‌شود (منبع واحد: lib/seoCheck.ts).
 */
export default function SeoPanel({ input, url }: { input: SeoInput; url: string }) {
  const checks = seoChecks(input);
  const { passed, total, percent } = seoScore(checks);
  const tone = percent >= 90 ? "text-success" : percent >= 60 ? "text-warning" : "text-danger";
  const serpTitle = (input.metaTitle || input.title || "").trim();
  const serpDesc = (input.metaDescription || input.excerpt || "").trim();

  return (
    <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display font-bold text-[.95rem] m-0">چک‌لیست سئو</h2>
        <span className={"text-[.85rem] font-extrabold " + tone}>
          {passed}/{total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[rgb(var(--c-ov)/.1)] overflow-hidden mb-4" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="امتیاز سئو">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan transition-all" style={{ width: `${percent}%` }} />
      </div>

      <div dir="rtl" className="rounded-xl border border-[rgb(var(--c-ov)/.12)] bg-[rgb(var(--c-sink)/.25)] p-3 mb-4">
        <div className="text-[.7rem] text-muted mb-1">پیش‌نمایش در گوگل</div>
        <div className="text-[.72rem] text-dim truncate" dir="ltr">{url}</div>
        <div className="text-[.95rem] font-bold text-cyan leading-[1.6] line-clamp-2">{serpTitle || "عنوان سئو"}</div>
        <div className="text-[.78rem] text-dim leading-[1.9] line-clamp-3">{serpDesc || "توضیحات متا اینجا نمایش داده می‌شود."}</div>
      </div>

      <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-[.78rem] leading-[1.7]">
            <span aria-hidden className={"mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full " + (c.ok ? "bg-success" : "bg-danger")} />
            <span>
              <span className={c.ok ? "text-dim" : "text-text font-bold"}>{c.label}</span>
              {!c.ok && c.hint && <span className="block text-muted text-[.74rem]">{c.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
