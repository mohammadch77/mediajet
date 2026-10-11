import type { ReactNode } from "react";
import Link from "next/link";
import { getAllContent } from "@/lib/content";
import SiteFooter from "@/components/SiteFooter";
import LegalToc from "@/components/LegalToc";
import SiteNav from "@/components/SiteNav";
import { headerNavItems } from "@/lib/legal";
import { LEGAL_VERSION, LEGAL_LINKS, INFO_LINKS } from "@/lib/legal";
import { toJalaliDate } from "@/lib/jalali";

type Tone = "good" | "warn" | "neutral";

export const LEGAL_ICONS = {
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  key: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  wallet: "M20 7H5a2 2 0 0 1 0-4h13v4Zm0 0v13H5a2 2 0 0 1-2-2V5m17 7h-4a2 2 0 0 0 0 4h4",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  bug: "M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 0 1 6 0v1.1M12 20a6 6 0 0 1-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3a6 6 0 0 1-6 6Zm0 0v-9M6 13H2m4-5L3 6m15 7h4m-4-5 3-2",
  check: "M20 6 9 17l-5-5",
  doc: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  cookie: "M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5zM8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01",
  refund: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  truck: "M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  card: "M2 5h20v14H2zM2 10h20",
  phone: "M7 2h10v20H7zM11 18h2",
  ban: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM4.9 4.9l14.2 14.2",
  type: "M4 7V4h16v3M9 20h6M12 4v16",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
} as const;
export type LegalIcon = keyof typeof LEGAL_ICONS;

function Icon({ name, size = 20 }: { name: LegalIcon; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={LEGAL_ICONS[name]} />
    </svg>
  );
}

export type LegalHighlight = { title: string; text: string; tone?: Tone; icon?: LegalIcon };

const TONE_BAR: Record<Tone, string> = {
  good: "bg-gradient-to-l from-success to-transparent",
  warn: "bg-gradient-to-l from-warning to-transparent",
  neutral: "bg-gradient-to-l from-cyan to-transparent",
};
const TONE_ICON: Record<Tone, string> = {
  good: "bg-[rgb(var(--c-success)/.14)] text-success border border-[rgb(var(--c-success)/.3)]",
  warn: "bg-[rgb(var(--c-warning)/.14)] text-warning border border-[rgb(var(--c-warning)/.3)]",
  neutral: "bg-[rgb(var(--c-cyan)/.12)] text-cyan border border-[rgb(var(--c-cyan)/.3)]",
};

/**
 * قالب مشترک صفحه‌های حقوقی: سربرگ با درخشش ملایم برند، خلاصه‌ی چند خطی،
 * فهرست چسبان کنار متن (دسکتاپ) یا جمع‌شونده (موبایل)، و بدنه با طول خط خوانا.
 */
export default async function LegalPage({
  title,
  intro,
  current,
  showUpdated = true,
  icon,
  highlights,
  children,
}: {
  title: string;
  intro?: string;
  current: keyof typeof LEGAL_LINKS | keyof typeof INFO_LINKS;
  /** نمایش «آخرین به‌روزرسانی» (برای صفحه‌های حقوقی). */
  showUpdated?: boolean;
  icon: LegalIcon;
  highlights?: LegalHighlight[];
  children: ReactNode;
}) {
  const content = await getAllContent();
  const navItems = headerNavItems(content);
  const isLegal = current in LEGAL_LINKS;
  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body flex flex-col">
      <SiteNav navItems={navItems} withAuthModal />
      <header className="relative overflow-hidden border-b border-[rgb(var(--c-primary2)/.14)]">
        {/* پس‌زمینه: شبکه‌ی محو + دو درخشش؛ همه تزئینی و بدون تأثیر بر خوانایی */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[.55]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--c-primary2) / .09) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-primary2) / .09) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            WebkitMaskImage: "radial-gradient(ellipse 70% 90% at 80% 20%, #000 20%, transparent 75%)",
            maskImage: "radial-gradient(ellipse 70% 90% at 80% 20%, #000 20%, transparent 75%)",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-24 w-[460px] h-[460px] rounded-full opacity-[.22] blur-3xl" style={{ background: "radial-gradient(circle, rgb(var(--c-primary)), transparent 70%)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-[10%] w-[360px] h-[360px] rounded-full opacity-[.14] blur-3xl" style={{ background: "radial-gradient(circle, rgb(var(--c-cyan)), transparent 70%)" }} />

        <div className="relative max-w-[1040px] mx-auto px-[5vw] pt-[104px] sm:pt-[128px] pb-10 sm:pb-14">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <nav aria-label="مسیر صفحه" className="text-[.82rem] text-dim flex items-center gap-2">
                <Link href="/" className="hover:text-text transition-colors">گت‌استوک</Link>
                <span aria-hidden>/</span>
                <span className="text-text">{title}</span>
              </nav>
              <h1 className="font-display font-extrabold text-[clamp(2rem,5.5vw,3.2rem)] leading-[1.25] mt-5 mb-4">{title}</h1>
              {intro && <p className="text-dim leading-[2] max-w-[58ch] text-[1rem]">{intro}</p>}
              {showUpdated && (
                <p className="inline-flex items-center gap-2 mt-5 text-[.8rem] text-dim rounded-full border border-[rgb(var(--c-primary2)/.22)] bg-[rgb(var(--c-ov)/.04)] px-3.5 py-1.5">
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-success" />
                  آخرین به‌روزرسانی: <time dateTime={LEGAL_VERSION}>{toJalaliDate(new Date(LEGAL_VERSION))}</time>
                </p>
              )}
            </div>

            {/* نشان بزرگ صفحه: کاشی شیشه‌ای با حلقه‌های هم‌مرکز */}
            <div aria-hidden className="hidden lg:grid place-items-center relative w-[200px] h-[200px]">
              <span className="absolute inset-0 rounded-full border border-[rgb(var(--c-primary2)/.22)]" />
              <span className="absolute inset-[22px] rounded-full border border-[rgb(var(--c-cyan)/.25)]" />
              <span className="absolute inset-[46px] rounded-full bg-[radial-gradient(circle,rgb(var(--c-primary)/.28),transparent_70%)]" />
              <span className="relative w-[84px] h-[84px] rounded-[26px] grid place-items-center text-white bg-gradient-to-br from-primary to-primary-deep shadow-[0_24px_60px_-18px_rgb(var(--c-primary)/.9)] border border-[rgb(255_255_255/.18)]">
                <Icon name={icon} size={38} />
              </span>
            </div>
          </div>

          {highlights && highlights.length > 0 && (
            <ul className="list-none p-0 mt-10 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
              {highlights.map((h) => (
                <li key={h.title} className="relative overflow-hidden rounded-2xl border border-[rgb(var(--c-primary2)/.22)] bg-[rgb(var(--c-surface)/.7)] backdrop-blur-md p-4 sm:p-5">
                  <span aria-hidden className={`absolute top-0 inset-x-0 h-[3px] ${TONE_BAR[h.tone ?? "neutral"]}`} />
                  <div className="flex items-start gap-3">
                    <span aria-hidden className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center ${TONE_ICON[h.tone ?? "neutral"]}`}>
                      <Icon name={h.icon ?? "check"} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-[1rem] leading-[1.6]">{h.title}</div>
                      <p className="m-0 mt-1 text-dim text-[.86rem] leading-[1.85]">{h.text}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <main id="main" className="flex-1 max-w-[1040px] w-full mx-auto px-[5vw] py-10 sm:py-14">
        <nav aria-label={isLegal ? "صفحه‌های حقوقی" : "صفحه‌های معرفی"} className="flex flex-wrap gap-2 mb-10 text-[.82rem] print:hidden">
          {(isLegal ? Object.entries(LEGAL_LINKS) : Object.entries(INFO_LINKS)).map(([k, link]) => {
            const on = k === current;
            return (
              <Link
                key={k}
                href={link.href}
                aria-current={on ? "page" : undefined}
                className={
                  "px-3.5 py-1.5 rounded-full border transition-colors " +
                  (on
                    ? "border-transparent bg-gradient-to-br from-primary to-primary-deep text-white font-semibold"
                    : "border-[rgb(var(--c-primary2)/.25)] text-dim hover:text-text hover:border-[rgb(var(--c-primary2)/.5)]")
                }
              >
                {link.label}
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



/** کارت‌های اطلاعاتی؛ هر مورد یک عنوان کوتاه و توضیح دارد. روی موبایل تک‌ستونه، از md دو ستونه. */
export function LegalCards({ items }: { items: { title: string; text: ReactNode; icon?: LegalIcon }[] }) {
  return (
    <ul className="list-none p-0 grid grid-cols-1 md:grid-cols-2 gap-3 !mt-4">
      {items.map((it) => (
        <li key={it.title} className="rounded-2xl border border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 p-4 flex gap-3.5 break-words">
          {it.icon && (
            <span aria-hidden className="shrink-0 w-10 h-10 rounded-xl grid place-items-center bg-[rgb(var(--c-primary)/.14)] text-primary2 border border-[rgb(var(--c-primary2)/.25)]">
              <Icon name={it.icon} />
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

/** گام‌های واقعاً ترتیبی (شماره‌ها معنا دارند). */
export function LegalSteps({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <ol className="list-none p-0 grid gap-3 !mt-4">
      {steps.map((st, i) => (
        <li key={st.title} className="flex gap-4 rounded-2xl border border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 p-4">
          <span aria-hidden className="shrink-0 w-10 h-10 rounded-full grid place-items-center font-display font-extrabold text-white bg-gradient-to-br from-primary to-primary-deep">
            {String(i + 1).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)])}
          </span>
          <div>
            <div className="font-display font-bold text-text text-[1rem]">{st.title}</div>
            <p className="m-0 mt-1 text-dim text-[.9rem] leading-[1.9]">{st.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** برچسب‌های کوتاه (مثلاً نام سایت‌ها)؛ بدون برش، با شکستن خط. */
export function LegalPills({ items, latin = false }: { items: string[]; latin?: boolean }) {
  return (
    <ul className="list-none p-0 flex flex-wrap gap-2 !mt-4">
      {items.map((t) => (
        <li key={t} className={"px-3 py-1.5 rounded-full text-[.84rem] text-text border border-[rgb(var(--c-primary2)/.25)] bg-[rgb(var(--c-ov)/.04)] " + (latin ? "latin" : "")}>
          {t}
        </li>
      ))}
    </ul>
  );
}
