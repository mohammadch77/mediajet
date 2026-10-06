"use client";
// چیدمان اصلی پنل ادمین: سایدبار ناوبری + هدر بالا. ریسپانسیو (سایدبار کشویی روی موبایل).

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
};

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "داشبورد", icon: <Icon path="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" /> },
  { href: "/admin/users", label: "کاربران", icon: <Icon path="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> },
  { href: "/admin/orders", label: "سفارش‌ها", icon: <Icon path="M3 7h18M3 7l1.5 12a2 2 0 0 0 2 1.8h11a2 2 0 0 0 2-1.8L21 7M3 7l1-3h16l1 3M9 11v5m6-5v5" /> },
  { href: "/admin/wallets", label: "کیف پول", icon: <Icon path="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16a1 1 0 0 1 1 1v3m0 0h-4a2 2 0 0 0 0 4h4v-4Z" /> },
  { href: "/admin/transactions", label: "تراکنش‌ها", icon: <Icon path="M4 20V10m6 10V4m6 16v-7" /> },
  { href: "/admin/affiliate", label: "همکاری در فروش", icon: <Icon path="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1m2 5a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /> },
  { href: "/admin/settings", label: "تنظیمات", icon: <Icon path="M10.3 2.5h3.4l.6 2.7 2.4-1.4 2.4 2.4-1.4 2.4 2.7.6v3.4l-2.7.6 1.4 2.4-2.4 2.4-2.4-1.4-.6 2.7h-3.4l-.6-2.7-2.4 1.4-2.4-2.4 1.4-2.4-2.7-.6V9.2l2.7-.6-1.4-2.4 2.4-2.4 2.4 1.4.6-2.7ZM9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z" /> },
  { href: "/admin/content", label: "محتوا", icon: <Icon path="M4 5h16v3H4V5Zm0 6h10v3H4v-3Zm0 6h16v2H4v-2Z" /> },
  { href: "/admin/pages", label: "صفحات", icon: <Icon path="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 0v5h5M8 13h8m-8 4h5" /> },
  { href: "/admin/blog", label: "وبلاگ", icon: <Icon path="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Zm3 5h9m-9 4h9m-9 4h5" /> },
  { href: "/admin/reports", label: "گزارش‌ها", icon: <Icon path="M3 3v18h18M8 17V10m5 7V6m5 11v-4" /> },
];

export default function AdminShell({
  adminMobile,
  adminName,
  children,
}: {
  adminMobile: string;
  adminName: string | null;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={
          "fixed lg:sticky top-0 right-0 h-screen w-[260px] shrink-0 z-40 bg-gradient-to-b from-surface to-bg2 border-l border-[rgb(var(--c-primary2)/.14)] flex flex-col transition-transform duration-300 " +
          (sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0")
        }
      >
        <div className="px-6 py-6 border-b border-[rgb(var(--c-primary2)/.14)]">
          <div className="latin text-[.75rem] tracking-[.14em] uppercase text-cyan font-bold">GetStock</div>
          <div className="font-display text-lg font-extrabold mt-1">پنل مدیریت</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            if (item.soon) {
              return (
                <div
                  key={item.href}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-dim/60 cursor-not-allowed select-none"
                  title="به‌زودی"
                >
                  {item.icon}
                  <span className="text-[.9rem] font-semibold flex-1">{item.label}</span>
                  <span className="text-[.65rem] bg-[rgb(var(--c-ov)/.06)] px-2 py-0.5 rounded-full">به‌زودی</span>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[.9rem] font-semibold transition " +
                  (active
                    ? "bg-gradient-to-br from-primary to-primary2 text-white"
                    : "text-dim hover:text-text hover:bg-[rgb(var(--c-ov)/.04)]")
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-[rgb(var(--c-primary2)/.14)]">
          <Link href="/" className="text-dim text-[.8rem] hover:text-text transition">
            ← بازگشت به سایت
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-bg/85 backdrop-blur border-b border-[rgb(var(--c-primary2)/.14)] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -mr-2 rounded-lg hover:bg-[rgb(var(--c-ov)/.06)] transition"
            aria-label="باز کردن منو"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-left hidden sm:block">
              <div className="text-[.85rem] font-bold">{adminName ?? "مدیر سیستم"}</div>
              <div dir="ltr" className="text-[.72rem] text-dim">{adminMobile}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-cyan grid place-items-center font-display font-extrabold text-sm shrink-0">
              {(adminName ?? "A").slice(0, 1).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-dim hover:text-accent2 hover:bg-[rgb(var(--c-accent)/.1)] transition"
              title="خروج"
              aria-label="خروج"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
