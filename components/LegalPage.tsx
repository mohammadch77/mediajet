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

const ICONS = {
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  key: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  wallet: "M20 7H5a2 2 0 0 1 0-4h13v4Zm0 0v13H5a2 2 0 0 1-2-2V5m17 7h-4a2 2 0 0 0 0 4h4",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  bug: "M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 0 1 6 0v1.1M12 20a6 6 0 0 1-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6Zm0 0v-9M6 13H2m4-5L3 6m15 7h4m-4-5 3-2",
  check: "M20 6 9 17l-5-5",
} as const;
export type LegalIcon = keyof typeof ICONS;

/** کارت‌های اطلاعاتی؛ هر مورد یک عنوان کوتاه و توضیح دارد. روی موبایل تک‌ستونه، از md دو ستونه. */
export function LegalCards({ items }: { items: { title: string; text: ReactNode; icon?: LegalIcon }[] }) {
  return (
    <ul className="list-none p-0 grid grid-cols-1 md:grid-cols-2 gap-3 !mt-4">
      {items.map((it) => (
        <li key={it.title} className="rounded-2xl border border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 p-4 flex gap-3.5 break-words">
          {it.icon && (
            <span aria-hidden className="shrink-0 w-10 h-10 rounded-xl grid place-items-center bg-[rgb(var(--c-primary)/.14)] text-primary2 border border-[rgb(var(--c-primary2)/.25)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS[it.icon]} />
              </svg>
            </span>
          )}
          <div className="min-w-0">
            <div className="font-display font-bold text-text text-[.98rem] leading-[1.6]">{it.title}</div>
            <p className="m-0 mt-1 text-dim text-[.88rem] leading-[1.9]">{it.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
