import type { ReactNode } from "react";
import Link from "next/link";
import { getAllContent } from "@/lib/content";
import SiteFooter from "@/components/SiteFooter";
import LegalToc from "@/components/LegalToc";
import { LEGAL_VERSION, LEGAL_LINKS } from "@/lib/legal";
import { toJalaliDate } from "@/lib/jalali";

type Tone = "good" | "warn" | "neutral";
export type LegalHighlight = { title: string; text: string; tone?: Tone };

const TONE_DOT: Record<Tone, string> = {
  good: "bg-success",
  warn: "bg-warning",
  neutral: "bg-cyan",
};

/**
 * قالب مشترک صفحه‌های حقوقی: سربرگ با درخشش ملایم برند، خلاصه‌ی چند خطی،
 * فهرست چسبان کنار متن (دسکتاپ) یا جمع‌شونده (موبایل)، و بدنه با طول خط خوانا.
 */
export default async function LegalPage({
  title,
  intro,
  current,
  highlights,
  children,
}: {
  title: string;
  intro?: string;
  current: keyof typeof LEGAL_LINKS;
  highlights?: LegalHighlight[];
  children: ReactNode;
}) {
  const content = await getAllContent();
  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body flex flex-col">
      <header className="relative overflow-hidden border-b border-[rgb(var(--c-primary2)/.14)]">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-[420px] h-[420px] rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle, rgb(var(--c-primary) / .55), transparent 70%)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-10 w-[320px] h-[320px] rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle, rgb(var(--c-cyan) / .5), transparent 70%)" }} />
        <div className="relative max-w-[1040px] mx-auto px-[5vw] pt-10 pb-10 sm:pt-14 sm:pb-12">
          <nav aria-label="مسیر صفحه" className="text-[.82rem] text-dim flex items-center gap-2">
            <Link href="/" className="hover:text-text transition-colors">گت‌استوک</Link>
            <span aria-hidden>/</span>
            <span className="text-text">{title}</span>
          </nav>
          <h1 className="font-display font-extrabold text-[clamp(2rem,5.5vw,3.2rem)] leading-[1.25] mt-5 mb-4">{title}</h1>
          {intro && <p className="text-dim leading-[2] max-w-[62ch] text-[1rem]">{intro}</p>}
          <p className="text-dim text-[.8rem] mt-4">
            آخرین به‌روزرسانی: <time dateTime={LEGAL_VERSION}>{toJalaliDate(new Date(LEGAL_VERSION))}</time>
          </p>

          {highlights && highlights.length > 0 && (
            <ul className="list-none p-0 mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {highlights.map((h) => (
                <li key={h.title} className="rounded-2xl border border-[rgb(var(--c-primary2)/.2)] bg-[rgb(var(--c-ov)/.04)] backdrop-blur-sm p-3.5 sm:p-4">
                  <div className="flex items-center gap-2 font-display font-bold text-[.95rem]">
                    <span aria-hidden className={`w-2 h-2 rounded-full ${TONE_DOT[h.tone ?? "neutral"]}`} />
                    {h.title}
                  </div>
                  <p className="m-0 mt-1.5 text-dim text-[.84rem] leading-[1.8]">{h.text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <main id="main" className="flex-1 max-w-[1040px] w-full mx-auto px-[5vw] py-10 sm:py-14">
        <nav aria-label="صفحه‌های حقوقی" className="flex flex-wrap gap-2 mb-10 text-[.82rem] print:hidden">
          {(Object.keys(LEGAL_LINKS) as (keyof typeof LEGAL_LINKS)[]).map((k) => {
            const on = k === current;
            return (
              <Link
                key={k}
                href={LEGAL_LINKS[k].href}
                aria-current={on ? "page" : undefined}
                className={
                  "px-3.5 py-1.5 rounded-full border transition-colors " +
                  (on
                    ? "border-transparent bg-gradient-to-br from-primary to-primary-deep text-white font-semibold"
                    : "border-[rgb(var(--c-primary2)/.25)] text-dim hover:text-text hover:border-[rgb(var(--c-primary2)/.5)]")
                }
              >
                {LEGAL_LINKS[k].label}
              </Link>
            );
          })}
        </nav>

        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <LegalToc />
          </aside>
          <div className="legal-body min-w-0 max-w-[68ch] lg:max-w-none xl:max-w-[68ch]">{children}</div>
        </div>
      </main>
      <SiteFooter content={content} />
    </div>
  );
}

/** «۳. عنوان» → شماره‌ی واقعی بند جدا از متن عنوان (بندها واقعاً دنباله‌ی شماره‌دار قانون‌اند). */
function splitTitle(title: string): { n?: string; text: string } {
  const m = title.match(/^([۰-۹0-9]+)[.\-)]\s*(.+)$/);
  return m ? { n: m[1], text: m[2] } : { text: title };
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  const { n, text } = splitTitle(title);
  const id = `s-${(n ?? "") + "-" + text.replace(/[^؀-ۿa-zA-Z0-9]+/g, "-")}`.replace(/-+$/g, "");
  return (
    <section className="py-8 first:pt-0 border-b border-[rgb(var(--c-primary2)/.12)] last:border-b-0">
      <h2 id={id} data-toc={text} className="scroll-mt-24 flex items-center gap-3 font-display font-bold text-[1.2rem] sm:text-[1.3rem] leading-[1.5] mb-3.5">
        {n && (
          <span aria-hidden className="shrink-0 w-9 h-9 rounded-xl grid place-items-center text-[.95rem] text-cyan bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.25)]">
            {n}
          </span>
        )}
        <span>{text}</span>
      </h2>
      <div className="text-dim leading-[2.05] text-[.96rem] space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-none p-0 space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[.85em] w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** پیام مهم داخل متن (مثلاً یک نکته‌ی کلیدی) با نوار رنگی کنار. */
export function LegalCallout({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const bar = tone === "warn" ? "border-warning" : tone === "good" ? "border-success" : "border-cyan";
  return (
    <div className={`rounded-xl border-s-4 ${bar} bg-[rgb(var(--c-ov)/.04)] px-4 py-3 text-[.9rem] leading-[1.95]`}>{children}</div>
  );
}

/** جدول مشترک صفحه‌های حقوقی؛ روی موبایل افقی اسکرول می‌شود. */
export function LegalTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[rgb(var(--c-primary2)/.2)]" tabIndex={0} role="region" aria-label={caption}>
      <table className="w-full min-w-[560px] text-[.86rem] border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-[rgb(var(--c-primary2)/.1)] text-text">
            {head.map((h) => (
              <th key={h} scope="col" className="text-start font-display font-bold p-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top border-t border-[rgb(var(--c-primary2)/.12)] odd:bg-[rgb(var(--c-ov)/.025)]">
              {r.map((c, j) => (
                <td key={j} className={"p-3 leading-[1.85] " + (j === 0 ? "text-text font-semibold" : "")}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
