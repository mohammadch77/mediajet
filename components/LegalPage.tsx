import type { ReactNode } from "react";
import Link from "next/link";
import { getAllContent } from "@/lib/content";
import SiteFooter from "@/components/SiteFooter";
import { LEGAL_VERSION, LEGAL_LINKS } from "@/lib/legal";
import { toJalaliDate } from "@/lib/jalali";

/** قالب مشترک صفحه‌های حقوقی؛ هم‌تم با بقیه‌ی سایت و ریسپانسیو. */
export default async function LegalPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  const content = await getAllContent();
  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body flex flex-col">
      <main id="main" className="flex-1 max-w-[760px] w-full mx-auto px-[5vw] py-14">
        <Link href="/" className="latin text-[.75rem] tracking-[.14em] uppercase text-cyan font-bold">
          ← گت‌استوک
        </Link>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-4 mb-2">{title}</h1>
        <p className="text-dim text-[.8rem] mb-6">آخرین به‌روزرسانی: {toJalaliDate(new Date(LEGAL_VERSION))}</p>
        {intro && <p className="text-dim leading-[2] mb-6">{intro}</p>}
        <nav aria-label="صفحه‌های حقوقی" className="flex flex-wrap gap-2 mb-8 text-[.8rem]">
          {Object.values(LEGAL_LINKS).map((l) => (
            <Link key={l.href} href={l.href} className="px-3 py-1.5 rounded-full border border-[rgb(var(--c-primary2)/.25)] text-dim hover:text-text transition">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="legal-body space-y-7">{children}</div>
      </main>
      <SiteFooter content={content} />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-[1.1rem] mb-2.5">{title}</h2>
      <div className="text-dim leading-[2] text-[.93rem] space-y-2.5">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc ps-5 space-y-1.5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
