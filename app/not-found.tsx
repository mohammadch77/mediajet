import type { Metadata } from "next";
import Link from "next/link";
import StatusScreen, { statusPrimaryBtn, statusSecondaryBtn } from "@/components/StatusScreen";
import SiteLogo from "@/components/SiteLogo";
import { ALL_SITES } from "@/data/categories";

export const metadata: Metadata = {
  title: "صفحه پیدا نشد — گت‌استوک",
  robots: "noindex, nofollow",
};

const SHOWN_SITES = ALL_SITES.slice(0, 10);

/** تصویر لینکِ شکسته: دو حلقه‌ی زنجیر با جرقه‌ی نارنجی در شکاف + عدد ۴۰۴ گرادیانی. */
function BrokenLinkVisual() {
  return (
    <div className="relative select-none" aria-hidden="true">
      <div className="mj-glow absolute inset-0 -z-10 blur-[50px] rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-primary)/.45),transparent)]" />
      <div className="latin font-latin font-bold leading-none text-[clamp(5.5rem,22vw,9rem)] tracking-[-.04em] bg-gradient-to-br from-primary2 via-primary to-cyan bg-clip-text text-transparent drop-shadow-[0_8px_40px_rgb(var(--c-primary)/.35)]">
        404
      </div>
      <svg className="mj-float mx-auto -mt-2" width="150" height="54" viewBox="0 0 150 54" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        <g className="text-primary2">
          <rect x="6" y="14" width="54" height="26" rx="13" />
          <path d="M60 27h-8" />
        </g>
        <g className="text-cyan">
          <rect x="90" y="14" width="54" height="26" rx="13" />
          <path d="M90 27h8" />
        </g>
        <g className="text-accent" strokeWidth="3.5">
          <path d="M70 12l4 8M80 8v9M90 12l-4 8M70 42l4-8M80 46v-9M90 42l-4-8" />
        </g>
      </svg>
    </div>
  );
}

// نمایش برای هر آدرسی که وجود ندارد (و هر جا notFound() صدا زده شود).
export default function NotFound() {
  return (
    <StatusScreen
      visual={<BrokenLinkVisual />}
      title="این صفحه پیدا نشد"
      description="لینکی که باز کردی وجود ندارد یا جابه‌جا شده است. اگر دنبال یک فایل استوک هستی، لینک محصولش را در صفحه‌ی اصلی بفرست تا برایت تحویل بگیریم."
      footer={
        <div className="text-center">
          <div className="text-dim text-[.8rem] mb-3">سایت‌هایی که فایلشان را برایت می‌گیریم</div>
          <ul className="flex flex-wrap justify-center gap-2" aria-label="سایت‌های پشتیبانی‌شده">
            {SHOWN_SITES.map((site) => (
              <li key={site} className="flex items-center gap-2 bg-[rgb(var(--c-ov)/.05)] border border-[rgb(var(--c-primary2)/.14)] rounded-full ps-1.5 pe-3.5 py-1.5">
                <SiteLogo site={site} className="h-6 w-6 rounded-[7px] text-[.6rem]" />
                <span className="latin font-latin text-[.74rem] text-dim">{site}</span>
              </li>
            ))}
            {ALL_SITES.length > SHOWN_SITES.length && (
              <li className="grid place-items-center text-dim text-[.78rem] px-3">و {ALL_SITES.length - SHOWN_SITES.length} سایت دیگر</li>
            )}
          </ul>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={statusPrimaryBtn}>
          بازگشت به صفحه‌ی اصلی
        </Link>
        <Link href="/dashboard" className={statusSecondaryBtn}>
          سفارش‌های من
        </Link>
        <Link href="/cart" className={statusSecondaryBtn}>
          سبد خرید
        </Link>
        <Link href="/blog" className={statusSecondaryBtn}>
          وبلاگ
        </Link>
      </div>
    </StatusScreen>
  );
}
