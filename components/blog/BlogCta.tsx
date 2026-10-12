import Link from "next/link";

/** دعوت به اقدام (خرید): نسخه‌ی کامل برای انتهای مقاله و نسخه‌ی فشرده برای ستون کناری. */
export default function BlogCta({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      aria-label="سفارش فایل"
      className={
        "relative overflow-hidden rounded-[24px] border border-[rgb(var(--c-primary2)/.28)] bg-gradient-to-br from-surface to-bg2 " +
        (compact ? "p-5" : "p-6 sm:p-9 my-10")
      }
    >
      <span aria-hidden className="pointer-events-none absolute -top-24 -left-20 h-56 w-56 rounded-full bg-primary opacity-[.18] blur-3xl" />
      <div className="relative">
        <div className="latin text-[.72rem] tracking-[.14em] uppercase text-cyan font-bold">Get Stock</div>
        <h2 className={"font-display font-extrabold text-text !border-0 !p-0 " + (compact ? "!text-[1.05rem] !mt-2 !mb-2" : "!text-[clamp(1.25rem,3vw,1.6rem)] !mt-2 !mb-3")}>
          فایل مورد نظرت را بدون اشتراک بگیر
        </h2>
        <p className={"text-dim !my-0 " + (compact ? "!text-[.82rem] !leading-[1.9]" : "!leading-[2]")}>
          لینک فایل را از سایت استوک بفرست، به ریال بپرداز و آماده‌ی دانلود را در پنل کاربری‌ات تحویل بگیر.
        </p>
        <div className={"flex flex-wrap gap-2.5 " + (compact ? "mt-4" : "mt-6")}>
          <Link
            href="/#cats"
            className="!no-underline rounded-[14px] px-5 py-2.5 text-[.88rem] font-bold text-[#1a0d00] bg-gradient-to-br from-[#ff7a3d] to-[#ffa266] shadow-[0_10px_30px_-12px_rgba(255,122,61,.8)] transition hover:-translate-y-0.5"
          >
            سفارش فایل
          </Link>
          <Link
            href="/pricing"
            className="!no-underline rounded-[14px] px-5 py-2.5 text-[.88rem] font-bold text-text border border-[rgb(var(--c-primary2)/.35)] transition hover:bg-[rgb(var(--c-ov)/.06)]"
          >
            مشاهده‌ی قیمت‌ها
          </Link>
        </div>
      </div>
    </aside>
  );
}
