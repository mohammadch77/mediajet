"use client";
import { useEffect, useRef, useState } from "react";

type Item = { id: string; text: string };

/**
 * فهرست بخش‌های صفحه‌ی حقوقی: روی دسکتاپ ستون چسبانِ کنار متن با خط راهنما،
 * روی موبایل یک بخش جمع‌شونده بالای متن. بخش فعال هنگام اسکرول مشخص می‌شود.
 * عنوان‌ها از h2[data-toc] خوانده می‌شوند، پس صفحه‌ها فقط LegalSection بنویسند.
 */
export default function LegalToc() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string>("");
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const heads = Array.from(document.querySelectorAll<HTMLElement>("h2[data-toc]"));
    setItems(heads.map((h) => ({ id: h.id, text: h.dataset.toc ?? h.textContent ?? "" })));
    if (!heads.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, []);

  if (items.length < 3) return null;

  const list = (
    <ol className="m-0 p-0 list-none border-s border-[rgb(var(--c-primary2)/.22)]">
      {items.map((it) => {
        const on = it.id === active;
        return (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={on ? "true" : undefined}
              onClick={() => details.current?.removeAttribute("open")}
              className={
                "block -ms-px ps-4 py-1.5 border-s-2 text-[.84rem] leading-[1.7] transition-colors " +
                (on ? "border-cyan text-text font-semibold" : "border-transparent text-dim hover:text-text")
              }
            >
              {it.text}
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <nav aria-label="فهرست این صفحه" className="print:hidden">
      <details ref={details} className="lg:hidden rounded-2xl border border-[rgb(var(--c-primary2)/.2)] bg-[rgb(var(--c-ov)/.03)] px-4 py-3 mb-8 [&[open]>summary]:mb-3">
        <summary className="cursor-pointer font-display font-bold text-[.92rem] list-none flex items-center justify-between">
          فهرست این صفحه
          <span aria-hidden className="text-dim text-[.8rem]">▾</span>
        </summary>
        {list}
      </details>
      <div className="hidden lg:block">
        <div className="font-display font-bold text-[.9rem] mb-3">در این صفحه</div>
        {list}
      </div>
    </nav>
  );
}
