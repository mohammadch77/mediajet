"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/CartContext";
import { toPersianDigits } from "@/lib/money";

/**
 * نوار بالای همه‌ی صفحه‌های عمومی (خانه، حقوقی، وبلاگ، صفحه‌های CMS).
 * `homeHref`: روی صفحه‌ی اصلی آدرس‌های #بخش همان‌جا اسکرول می‌کنند؛ بیرون از خانه باید با «/» شروع شوند.
 * `withAuthModal`: صفحه‌ی اصلی مودال ورود را خودش دارد؛ بقیه‌ی صفحه‌ها از اینجا می‌گیرند.
 */
export default function SiteNav({
  navItems,
  withAuthModal = false,
}: {
  navItems: string[][];
  withAuthModal?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, logout, authModalOpen, openAuthModal, closeAuthModal } = useAuth();
  const { count: cartCount } = useCart();

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <>
      <nav aria-label="منوی اصلی" className="fixed top-[14px] sm:top-[18px] left-1/2 -translate-x-1/2 z-[200] w-full max-w-[94vw] sm:w-auto">
        <div className="flex items-center gap-2 bg-[rgb(var(--c-surface)/.7)] backdrop-blur-[20px] border border-[rgb(var(--c-primary2)/.14)] rounded-full py-2 px-3 sm:p-[8px_8px_8px_20px] shadow-[0_30px_80px_-30px_rgba(0,0,0,.75)]">
          <div className="flex items-center gap-2 sm:gap-2.5 font-display font-extrabold text-[1rem] sm:text-[1.15rem] whitespace-nowrap shrink-0">
            <BrandLogo className="w-[28px] h-[28px] sm:w-[30px] sm:h-[30px] shadow-[0_0_60px_-10px_#6B5BFF]" />
            گت‌استوک
          </div>
          <div className="flex gap-1 mx-1.5 max-[1100px]:hidden">
            {navItems.map(([href, label]) => (
              <a key={href} href={href} className="text-dim text-[.9rem] font-medium px-3.5 py-2 rounded-full transition hover:text-text hover:bg-[rgb(var(--c-ov)/.05)] whitespace-nowrap">
                {label}
              </a>
            ))}
          </div>

          <ThemeToggle />

          {!loading && user && <NotificationBell />}

          {/* cart badge — همیشه دیده می‌شود تا کاربر بداند چند آیتم در سبد دارد */}
          <Link
            href="/cart"
            aria-label="سبد خرید"
            className="relative shrink-0 w-9 h-9 grid place-items-center rounded-full bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)] transition hover:bg-[rgb(var(--c-ov)/.12)]"
          >
            <svg viewBox="0 0 24 24" fill="none" width="17" height="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-on-solid text-[.65rem] font-bold grid place-items-center">
                {toPersianDigits(cartCount)}
              </span>
            )}
          </Link>

          {/* desktop auth area */}
          <div className="max-[1100px]:hidden">
            {!loading && user ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  href="/dashboard"
                  className="text-text text-[.85rem] font-semibold px-3.5 py-2 rounded-full whitespace-nowrap transition hover:bg-[rgb(var(--c-ov)/.05)]"
                >
                  پنل کاربری
                </Link>
                <span dir="ltr" className="text-text text-[.85rem] font-semibold px-3.5 py-2 whitespace-nowrap">
                  {user.mobile}
                </span>
                <button
                  onClick={logout}
                  className="font-body cursor-pointer border-none font-bold text-[.85rem] text-text bg-[rgb(var(--c-ov)/.08)] px-4 py-2.5 rounded-full whitespace-nowrap shrink-0 transition hover:bg-[rgb(var(--c-ov)/.16)]"
                >
                  خروج
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="font-body cursor-pointer border-none font-bold text-[.9rem] text-white bg-gradient-to-br from-primary to-primary-deep px-[18px] py-2.5 rounded-full whitespace-nowrap shrink-0 transition hover:-translate-y-px hover:shadow-[0_0_60px_-10px_#6B5BFF]"
              >
                ورود / ثبت‌نام
              </button>
            )}
          </div>

          {/* mobile hamburger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="باز کردن منو"
            aria-expanded={menuOpen}
            className="min-[1101px]:hidden mr-auto shrink-0 w-9 h-9 grid place-items-center rounded-full bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)] transition hover:bg-[rgb(var(--c-ov)/.12)]"
          >
            <div className="w-[16px] flex flex-col gap-[4px] items-center">
              <span className={`block h-[2px] w-full bg-text rounded transition-transform ${menuOpen ? "translate-y-[6px] rotate-45" : ""}`} />
              <span className={`block h-[2px] w-full bg-text rounded transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-[2px] w-full bg-text rounded transition-transform ${menuOpen ? "-translate-y-[6px] -rotate-45" : ""}`} />
            </div>
          </button>
        </div>

        {/* mobile dropdown panel */}
        {menuOpen && (
          <div className="min-[1101px]:hidden mt-2 bg-[rgb(var(--c-surface)/.92)] backdrop-blur-[20px] border border-[rgb(var(--c-primary2)/.14)] rounded-[20px] p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,.75)] flex flex-col gap-1">
            {navItems.map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="text-text text-[.9rem] font-medium px-4 py-2.5 rounded-xl transition hover:bg-[rgb(var(--c-ov)/.06)]"
              >
                {label}
              </a>
            ))}
            <div className="h-px bg-[rgb(var(--c-primary2)/.14)] my-1" />
            {!loading && user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="text-text text-[.9rem] font-semibold px-4 py-2.5 rounded-xl transition hover:bg-[rgb(var(--c-ov)/.06)]"
                >
                  پنل کاربری
                </Link>
                <span dir="ltr" className="text-dim text-[.85rem] font-semibold px-4 py-1.5">
                  {user.mobile}
                </span>
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="font-body cursor-pointer border-none text-right font-bold text-[.9rem] text-text bg-[rgb(var(--c-ov)/.08)] px-4 py-2.5 rounded-xl transition hover:bg-[rgb(var(--c-ov)/.16)]"
                >
                  خروج
                </button>
              </>
            ) : (
              <button
                onClick={() => { setMenuOpen(false); openAuthModal(); }}
                className="font-body cursor-pointer border-none font-bold text-[.9rem] text-white bg-gradient-to-br from-primary to-primary-deep px-4 py-3 rounded-xl transition"
              >
                ورود / ثبت‌نام
              </button>
            )}
          </div>
        )}
      </nav>
      {withAuthModal && <AuthModal open={authModalOpen} onClose={closeAuthModal} />}
    </>
  );
}
