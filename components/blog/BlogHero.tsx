import Link from "next/link";
import type { ReactNode } from "react";

/** سربرگ صفحه‌های بلاگ: همان زبان طراحی صفحه‌های درباره ما/قیمت‌ها (شبکه‌ی محو، درخشش، breadcrumb). */
export default function BlogHero({ title, intro, crumbs, children }: { title: string; intro?: string; crumbs: { label: string; href?: string }[]; children?: ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b border-[rgb(var(--c-primary2)/.14)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.35] [background-image:linear-gradient(rgb(var(--c-primary2)/.12)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--c-primary2)/.12)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
      <div aria-hidden className="pointer-events-none absolute -top-32 right-[-6rem] h-72 w-72 rounded-full bg-primary opacity-[.16] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-[-4rem] h-64 w-64 rounded-full bg-cyan opacity-[.1] blur-3xl" />
      <div className="relative mx-auto max-w-[1100px] px-[5vw] pt-32 pb-12 sm:pt-36 sm:pb-14">
        <nav aria-label="مسیر صفحه" className="text-[.8rem] text-muted flex flex-wrap items-center gap-1.5">
          {crumbs.map((c, i) => (
            <span key={c.label} className="inline-flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>/</span>}
              {c.href ? <Link href={c.href} className="hover:text-text transition">{c.label}</Link> : <span aria-current="page" className="text-text font-bold">{c.label}</span>}
            </span>
          ))}
        </nav>
        <h1 className="font-display font-extrabold text-[clamp(1.9rem,5vw,3.1rem)] leading-[1.45] mt-5 mb-0">{title}</h1>
        {intro && <p className="text-dim text-[clamp(.95rem,2vw,1.08rem)] leading-[2.1] max-w-[62ch] mt-4 mb-0">{intro}</p>}
        {children}
      </div>
    </header>
  );
}
