import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

/**
 * قالب مشترک صفحه‌های وضعیت (۴۰۴، بازیابی بعد از خطا) هم‌سبک صفحه‌ی اصلی گت‌استوک:
 * پس‌زمینه‌ی گرادیان تیره، هدر برند، کارت شیشه‌ای وسط. بدون hook است تا هم در سرور و هم کلاینت کار کند.
 */
export default function StatusScreen({
  visual,
  title,
  description,
  children,
  footer,
}: {
  visual: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col">
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(60vw 60vw at 80% -10%,rgb(var(--c-primary)/.18),transparent 60%),radial-gradient(50vw 50vw at 0% 20%,rgb(var(--c-cyan)/.10),transparent 60%),radial-gradient(50vw 50vw at 50% 120%,rgb(var(--c-accent)/.12),transparent 60%)",
        }}
      />

      <header className="px-4 sm:px-8 pt-5 sm:pt-7">
        <Link href="/" className="inline-flex items-center gap-2.5 font-display font-extrabold text-[1.05rem] sm:text-[1.2rem]">
          <BrandLogo className="w-[30px] h-[30px] shadow-[0_0_60px_-10px_#6B5BFF]" />
          گت‌استوک
        </Link>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[640px] text-center bg-gradient-to-br from-surface/80 to-bg2/80 backdrop-blur-[18px] border border-[rgb(var(--c-primary2)/.16)] rounded-[28px] shadow-[0_40px_100px_-40px_rgba(0,0,0,.7)] px-5 sm:px-10 py-9 sm:py-12">
          <div className="mb-5 sm:mb-6 flex justify-center">{visual}</div>
          <h1 className="font-display text-[clamp(1.5rem,5vw,2.1rem)] font-extrabold leading-[1.4] mb-3">{title}</h1>
          <p className="text-dim text-[.95rem] sm:text-[1rem] leading-[2] max-w-[460px] mx-auto">{description}</p>
          {children && <div className="mt-7 sm:mt-8">{children}</div>}
        </div>
        {footer && <div className="w-full max-w-[640px] mt-6 sm:mt-8">{footer}</div>}
      </main>
    </div>
  );
}

/** دکمه‌ی اصلی (گرادیان برند) و ثانویه برای صفحه‌های وضعیت. */
export const statusPrimaryBtn =
  "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-white text-[.95rem] bg-gradient-to-br from-primary to-primary2 shadow-[0_14px_40px_-14px_rgb(var(--c-primary))] transition hover:-translate-y-px cursor-pointer border-none";
export const statusSecondaryBtn =
  "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-[.88rem] text-dim hover:text-text bg-[rgb(var(--c-ov)/.05)] border border-[rgb(var(--c-primary2)/.2)] transition hover:border-primary2 cursor-pointer";
