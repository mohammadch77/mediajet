import Link from "next/link";

export type FaqEntry = { q: string; a: string; href?: string; hrefLabel?: string };

/** پرسش‌وپاسخ آکاردئونی با <details> بومی: با کیبورد و صفحه‌خوان کار می‌کند و بدون جاوااسکریپت است. */
export default function FaqList({ items }: { items: FaqEntry[] }) {
  return (
    <div className="grid gap-2.5 !mt-4">
      {items.map((it) => (
        <details key={it.q} className="group rounded-2xl border border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 open:border-[rgb(var(--c-cyan)/.4)] transition-colors">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-4 sm:p-5 font-display font-bold text-text text-[.98rem] leading-[1.7] [&::-webkit-details-marker]:hidden">
            <span>{it.q}</span>
            <span aria-hidden className="shrink-0 w-7 h-7 rounded-full grid place-items-center border border-[rgb(var(--c-primary2)/.3)] text-cyan transition-transform group-open:rotate-45">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
          </summary>
          <div className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1 text-dim text-[.92rem] leading-[2]">
            <p className="m-0">{it.a}</p>
            {it.href && (
              <Link href={it.href} className="inline-block mt-2 text-cyan underline">
                {it.hrefLabel ?? "ادامه"}
              </Link>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
