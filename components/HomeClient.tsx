"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CATEGORIES, ALL_SITES, type Category } from "@/data/categories";
import SiteLogo from "@/components/SiteLogo";
import { toPersianDigits } from "@/lib/money";
import { useLinkDetect } from "@/lib/useLinkDetect";
import { unsupportedSiteMessage, sitePresetEntry, type LinkEntry } from "@/lib/linkDetect";
import OrderDrawer from "@/components/OrderDrawer";
import AuthModal from "@/components/AuthModal";
import NotificationBell from "@/components/NotificationBell";
import SiteMarquee from "@/components/SiteMarquee";
import WalletCard from "@/components/WalletCard";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/CartContext";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import ThemeToggle from "@/components/ThemeToggle";
import type { AffiliateProgramInfo } from "@/lib/affiliateSummary";

// صحنه‌ی سه‌بعدی فقط سمت کلاینت لود شود
const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

const STEPS = [
  { n: "01", title: "لینک را بفرست", desc: "آدرس محصول را از هر سایت پشتیبانی‌شده کپی کن و در فرم دسته‌ی مربوطه بگذار.", highlight: undefined as string | undefined },
  { n: "02", title: "پرداخت جزئی", desc: "قیمت خودکار محاسبه می‌شود؛ از کیف پول یا درگاه مبلغ ناچیزی می‌پردازی.", highlight: "با کیف پول شارژشده، سفارش‌ها سریع‌تر و ارزان‌تر انجام می‌شوند — بدون رفتن به درگاه هر بار." as string | undefined },
  { n: "03", title: "فایل را بگیر", desc: "فایل اصلی و باکیفیت را دانلود کرده و در پنلت آماده‌ی دانلود قرار می‌دهیم.", highlight: undefined as string | undefined },
];

// تعداد دسته‌هایی که هر سایت پشتیبانی می‌کند، از روی CATEGORIES محاسبه می‌شود (منبع واحد حقیقت).
const SITE_CATEGORY_COUNTS: { site: string; count: number }[] = ALL_SITES.map((site) => ({
  site,
  count: CATEGORIES.filter((c) => c.sites.includes(site)).length,
})).sort((a, b) => b.count - a.count);

// نظرهای مشتری‌ها فعلاً نمونه/جای‌نگهدار هستند چون هنوز مشتری واقعی نداریم.
// بعداً باید با نظرات واقعی جایگزین شوند.
const TESTIMONIALS = [
  { name: "امیرحسین رضایی", role: "طراح گرافیک فریلنس", stars: 5, text: "خیلی سریع‌تر و ارزان‌تر از خرید اشتراک ماهانه بود. دقیقاً همون فایلی که لازم داشتم رو گرفتم." },
  { name: "سارا محمدی", role: "مدیر محتوای آژانس تبلیغاتی", stars: 5, text: "برای پروژه‌های مشتری‌هامون از چند تا سایت مختلف فایل لازم داریم، اینجا همه رو یک‌جا پوشش می‌ده." },
  { name: "علی کریمی", role: "تدوینگر ویدیو", stars: 4, text: "کیفیت فایل‌های ویدیویی عالی بود و پشتیبانی هم سریع جواب داد." },
];

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function HomeClient({
  content,
  affiliate,
}: {
  content: Record<string, string>;
  affiliate: AffiliateProgramInfo;
}) {
  const [drawerCat, setDrawerCat] = useState<Category | null>(null);
  const [linkEntry, setLinkEntry] = useState<LinkEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [heroLink, setHeroLink] = useState("");
  const [heroError, setHeroError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, logout, authModalOpen, openAuthModal, closeAuthModal } = useAuth();
  const { count: cartCount } = useCart();
  const heroDetection = useLinkDetect(heroLink);
  useReveal();

  const navItems = [
    [content["header.nav1_href"], content["header.nav1_label"]],
    [content["header.nav2_href"], content["header.nav2_label"]],
    [content["header.nav3_href"], content["header.nav3_label"]],
    [content["header.nav4_href"], content["header.nav4_label"]],
  ];

  const openCat = (c: Category) => { setDrawerCat(c); setLinkEntry(null); setOpen(true); };
  const openSite = (site: string) => { setDrawerCat(null); setLinkEntry(sitePresetEntry(site)); setOpen(true); };
  const close = () => setOpen(false);

  // فیلد اصلی: کاربر فقط لینک را می‌دهد؛ فقط سایت از روی دامنه تشخیص داده می‌شود.
  // دسته‌ی محصول همیشه در دراور از خود کاربر پرسیده می‌شود. اگر سایت پشتیبانی نشود،
  // پیام روشن همراه با لیست سایت‌های پشتیبانی‌شده نشان داده می‌شود.
  const handleHeroLink = () => {
    const url = heroLink.trim();
    if (!url) { setHeroError("لینک محصول را وارد کن."); return; }
    if (!heroDetection.supported) {
      setHeroError(unsupportedSiteMessage());
      return;
    }
    setHeroError(null);
    setLinkEntry({ link: url, site: heroDetection.site, candidates: heroDetection.candidates });
    setDrawerCat(null);
    setOpen(true);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ambient background */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(60vw 60vw at 80% -10%,rgb(var(--c-primary)/.18),transparent 60%),radial-gradient(50vw 50vw at 0% 20%,rgb(var(--c-cyan)/.10),transparent 60%),radial-gradient(50vw 50vw at 50% 120%,rgb(var(--c-accent)/.12),transparent 60%)",
        }}
      />

      {/* floating nav */}
      <nav className="fixed top-[14px] sm:top-[18px] left-1/2 -translate-x-1/2 z-[200] w-full max-w-[94vw] sm:w-auto">
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
              <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[.65rem] font-bold grid place-items-center">
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
                className="font-body cursor-pointer border-none font-bold text-[.9rem] text-white bg-gradient-to-br from-primary to-primary2 px-[18px] py-2.5 rounded-full whitespace-nowrap shrink-0 transition hover:-translate-y-px hover:shadow-[0_0_60px_-10px_#6B5BFF]"
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
                className="font-body cursor-pointer border-none font-bold text-[.9rem] text-white bg-gradient-to-br from-primary to-primary2 px-4 py-3 rounded-xl transition"
              >
                ورود / ثبت‌نام
              </button>
            )}
          </div>
        )}
      </nav>

      {/* HERO */}
      <header className="relative min-h-screen grid place-items-center text-center px-[5vw] pt-[120px] pb-20">
        <HeroScene />
        <div className="relative z-[3] max-w-[900px] w-full">
          <span className="inline-flex items-center gap-2 text-[.82rem] font-semibold text-accent2 bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.25)] px-4 py-[7px] rounded-full mb-[26px]">
            <span className="w-[7px] h-[7px] rounded-full bg-accent" style={{ animation: "mj-pulse 2s infinite" }} />
            {content["hero.eyebrow"]}
          </span>
          <h1 className="font-display text-[clamp(2.3rem,7vw,5rem)] font-extrabold leading-[1.22] tracking-[-.01em] mb-[22px]">
            {content["hero.title_line1"]}
            <br />
            <span style={{ background: "linear-gradient(110deg,#8A7CFF,#38E1FF 60%,#FF9A5C)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              {content["hero.title_line2"]}
            </span>
          </h1>
          <p className="text-dim text-[clamp(1rem,2.5vw,1.25rem)] max-w-[46ch] mx-auto mb-9">
            {content["hero.subtitle"]}
          </p>
          <div className="flex gap-3.5 flex-wrap justify-center mb-5">
            <a href="#cats" className="font-body cursor-pointer border-none font-bold rounded-[14px] transition text-[1.05rem] px-8 py-4 bg-gradient-to-br from-accent to-accent2 text-white shadow-[0_12px_30px_-10px_#FF6B35] hover:-translate-y-[3px]">
              {content["hero.button_primary"]}
            </a>
            <a href="#how" className="font-body cursor-pointer font-bold rounded-[14px] transition text-[1.05rem] px-8 py-4 bg-[rgb(var(--c-ov)/.06)] text-text border border-[rgb(var(--c-primary2)/.14)] backdrop-blur-[10px] hover:bg-[rgb(var(--c-ov)/.1)] hover:-translate-y-[3px]">
              {content["hero.button_secondary"]}
            </a>
          </div>

          {/* فیلد اصلی لینک: کاربر فقط لینک را می‌دهد، سایت/دسته خودکار تشخیص داده می‌شود */}
          <div className="max-w-[560px] mx-auto text-right">
            <div className="flex gap-2.5 max-[520px]:flex-col">
              <input
                dir="ltr"
                value={heroLink}
                onChange={(e) => { setHeroLink(e.target.value); setHeroError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleHeroLink()}
                type="text"
                placeholder="لینک محصول را اینجا بگذار…"
                className="flex-1 latin text-[.95rem] text-text bg-[rgb(var(--c-sink)/.35)] border border-[rgb(var(--c-primary2)/.24)] rounded-xl p-[14px_16px] backdrop-blur-[10px] transition focus:border-primary focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/.15)] outline-none"
              />
              <button
                onClick={handleHeroLink}
                className="font-body cursor-pointer border-none font-bold rounded-xl transition text-[.95rem] px-6 py-[14px] bg-gradient-to-br from-primary to-primary2 text-white shadow-[0_12px_30px_-10px_#6B5BFF] hover:-translate-y-0.5 shrink-0"
              >
                بررسی لینک
              </button>
            </div>
            <div className="text-[.82rem] mt-2.5 min-h-[20px]">
              {heroError ? (
                <span className="text-accent2">{heroError}</span>
              ) : heroLink && heroDetection.supported ? (
                <span className="text-dim">
                  سایت شناسایی شد: <b className="text-cyan">{heroDetection.site}</b>
                </span>
              ) : (
                <span className="text-dim">لینک را بگذار تا سایت به‌صورت خودکار شناسایی شود.</span>
              )}
            </div>
          </div>
        </div>
        <div className="absolute bottom-[26px] left-1/2 -translate-x-1/2 z-[3] text-dim text-[.8rem] flex flex-col items-center gap-1.5" style={{ animation: "mj-bob 2.2s ease-in-out infinite" }}>
          اسکرول کن<span className="text-[1.1rem]">↓</span>
        </div>
      </header>

      {/* SUPPORTED SITES MARQUEE */}
      <section className="reveal px-[5vw] pb-[clamp(50px,8vw,90px)]">
        <div className="text-center mb-6">
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Trusted Sources</div>
          <h2 className="font-display text-[clamp(1.3rem,3vw,1.8rem)] font-extrabold mt-2">از این سایت‌ها برایت فایل می‌گیریم</h2>
        </div>
        <SiteMarquee />
      </section>

      {/* HOW */}
      <section id="how" className="px-[5vw] py-[clamp(70px,10vw,120px)] max-w-[1200px] mx-auto">
        <div className="reveal text-center mb-[clamp(40px,6vw,64px)]">
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Simple as 1-2-3</div>
          <h2 className="font-display text-[clamp(1.7rem,4.5vw,2.8rem)] font-extrabold mt-3 mb-3.5">روند کار چطوری است؟</h2>
          <p className="text-dim max-w-[52ch] mx-auto">نیازی به اشتراک ماهانه گران نیست؛ فقط همان یک فایلی که لازم داری را می‌گیری.</p>
        </div>
        <div className="grid grid-cols-3 gap-5 max-[820px]:grid-cols-1">
          {STEPS.map((s) => (
            <div key={s.n} className="reveal bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-[20px] p-[32px_26px] transition hover:-translate-y-2 hover:border-[rgb(var(--c-primary2)/.5)]">
              <div className="latin text-[.85rem] font-bold text-accent w-10 h-10 rounded-xl bg-[rgb(var(--c-accent)/.12)] grid place-items-center mb-5">{s.n}</div>
              <h3 className="font-display text-[1.25rem] mb-2">{s.title}</h3>
              <p className="text-dim text-[.95rem]">{s.desc}</p>
              {s.highlight && (
                <a
                  href="#wallet"
                  className="mt-3.5 flex items-start gap-2 text-cyan text-[.82rem] leading-[1.7] no-underline hover:text-[rgb(var(--c-cyan)/.8)]"
                >
                  <span className="shrink-0">💳</span>
                  <span>{s.highlight}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="cats" className="px-[5vw] py-[clamp(70px,10vw,120px)] max-w-[1200px] mx-auto">
        <div className="reveal text-center mb-[clamp(40px,6vw,64px)]">
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Full Coverage</div>
          <h2 className="font-display text-[clamp(1.7rem,4.5vw,2.8rem)] font-extrabold mt-3 mb-3.5">از تمام دسته‌ها پشتیبانی می‌کنیم</h2>
          <p className="text-dim max-w-[52ch] mx-auto">روی هر دسته بزن تا فرم سفارشش باز شود.</p>
        </div>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {CATEGORIES.map((c) => (
            <div
              key={c.id}
              onClick={() => openCat(c)}
              className="reveal group relative bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-[18px] p-[24px_22px] cursor-pointer transition hover:-translate-y-1.5 hover:border-[rgb(var(--c-cyan)/.4)] hover:shadow-[0_20px_40px_-20px_rgb(var(--c-cyan)/.3)]"
            >
              <span className="absolute top-[22px] left-[22px] text-dim text-[1.1rem] transition group-hover:text-cyan group-hover:-translate-x-1">←</span>
              <div className="text-[1.8rem] mb-3 drop-shadow-[0_4px_8px_rgba(0,0,0,.4)]">{c.icon}</div>
              <h4 className="font-display text-[1.05rem] mb-[5px]">{c.title}</h4>
              <div className="text-dim text-[.8rem]">{toPersianDigits(c.sites.length)} سایت پشتیبان</div>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTS (SITE CARDS) */}
      <section id="products" className="px-[5vw] py-[clamp(70px,10vw,120px)] max-w-[1200px] mx-auto">
        <div className="reveal text-center mb-[clamp(40px,6vw,64px)]">
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Our Sources</div>
          <h2 className="font-display text-[clamp(1.7rem,4.5vw,2.8rem)] font-extrabold mt-3 mb-3.5">محصولات ما، همان سایت‌های استوک هستند</h2>
          <p className="text-dim max-w-[52ch] mx-auto">روی هر سایت بزن تا دسته‌های قابل سفارش از آن را ببینی.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 min-[600px]:grid-cols-3 min-[900px]:grid-cols-4">
          {SITE_CATEGORY_COUNTS.map(({ site, count }) => (
            <div
              key={site}
              onClick={() => openSite(site)}
              className="reveal group relative bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-[18px] p-[22px_18px] cursor-pointer transition hover:-translate-y-1.5 hover:border-[rgb(var(--c-cyan)/.4)] hover:shadow-[0_20px_40px_-20px_rgb(var(--c-cyan)/.3)]"
            >
              <SiteLogo site={site} className="w-10 h-10 rounded-[10px] text-[.75rem] mb-3" />
              <h4 className="latin font-display text-[1rem] mb-1 truncate">{site}</h4>
              <div className="text-dim text-[.8rem]">{toPersianDigits(count)} دسته‌ی قابل سفارش</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="reveal px-[5vw] py-[clamp(70px,10vw,120px)] max-w-[1200px] mx-auto">
        <div className="reveal text-center mb-[clamp(40px,6vw,64px)]">
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Testimonials</div>
          <h2 className="font-display text-[clamp(1.7rem,4.5vw,2.8rem)] font-extrabold mt-3">نظر مشتری‌ها</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 min-[700px]:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="reveal bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-[20px] p-[28px_24px] transition hover:-translate-y-1.5 hover:border-[rgb(var(--c-primary2)/.5)]"
            >
              <div className="latin text-accent2 text-[1.1rem] mb-3 tracking-[.1em]">
                {"★".repeat(t.stars)}
                <span className="text-[rgb(var(--c-ov)/.15)]">{"★".repeat(5 - t.stars)}</span>
              </div>
              <p className="text-dim text-[.95rem] leading-[1.9] mb-5">{t.text}</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center font-display font-bold text-white shrink-0">
                  {t.name.slice(0, 1)}
                </div>
                <div>
                  <div className="font-bold text-[.9rem]">{t.name}</div>
                  <div className="text-dim text-[.78rem]">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WALLET */}
      <section id="wallet" className="px-[5vw] py-[clamp(70px,10vw,120px)] max-w-[1200px] mx-auto">
        <div className="grid grid-cols-[1.1fr_1fr] gap-[34px] items-center max-[820px]:grid-cols-1 max-[820px]:gap-6">
          <div className="reveal">
            {user ? (
              <WalletCard
                balanceLabel={
                  <>
                    {toPersianDigits(Math.round(Number(user?.walletBalanceRial ?? 0) / 10).toLocaleString("en-US"))}{" "}
                    <small className="text-base font-medium">تومان</small>
                  </>
                }
              >
                <div className="flex gap-2.5 flex-wrap">
                  {["۱۰۰٬۰۰۰", "۵۰۰٬۰۰۰", "۱٬۰۰۰٬۰۰۰"].map((v) => (
                    <button key={v} className="font-body bg-[rgba(255,255,255,.16)] border-none text-white font-bold px-4 py-2.5 rounded-[11px] cursor-pointer transition hover:bg-[rgba(255,255,255,.32)] hover:-translate-y-0.5">
                      + {v}
                    </button>
                  ))}
                </div>
              </WalletCard>
            ) : (
              <WalletCard
                eyebrowLabel="کیف پول شما"
                badgeLabel="هنوز فعال نشده"
                balanceLabel="وارد شو، کیف پولت را فعال کن"
              >
                <p className="text-[rgb(var(--c-ov)/.85)] text-[.9rem] leading-[1.9] mb-5">
                  با ورود، یک کیف پول برایت فعال می‌شود. شارژش کن تا هر سفارش سریع‌تر و ارزان‌تر از موجودی پرداخت شود — بدون نیاز به رفتن به درگاه در هر خرید.
                </p>
                <button
                  onClick={openAuthModal}
                  className="font-body cursor-pointer border-none font-bold text-[.9rem] text-primary2 bg-white px-5 py-2.5 rounded-full transition hover:-translate-y-px"
                >
                  ورود / شارژ کیف پول
                </button>
              </WalletCard>
            )}
          </div>
          <div className="reveal">
            <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Wallet</div>
            <h3 className="font-display text-[1.6rem] mt-2.5 mb-3">یک‌بار شارژ کن، بی‌وقفه سفارش بده</h3>
            <p className="text-dim mb-3.5">با شارژ کیف پول، دیگر برای هر سفارش وارد درگاه نمی‌شوی.</p>
            <ul className="m-0 p-0">
              {["پرداخت آنی از موجودی", "تاریخچه‌ی کامل تراکنش‌ها", "اعتبار هدیه در شارژهای بالا"].map((t) => (
                <li key={t} className="text-dim list-none pr-7 relative mb-2.5">
                  <span className="absolute right-0 text-cyan font-black">✓</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* AFFILIATE — معرفی همکاری در فروش؛ درصد و حداقل تسویه از تنظیمات واقعی می‌آیند */}
      <section id="affiliate" className="px-[5vw] pb-[clamp(70px,10vw,120px)] max-w-[1200px] mx-auto">
        <div className="reveal relative overflow-hidden rounded-[26px] border border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 p-[clamp(24px,5vw,48px)]">
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[rgb(var(--c-accent)/.14)] blur-3xl pointer-events-none" />
          <div className="relative grid grid-cols-[1.3fr_1fr] gap-[clamp(20px,4vw,40px)] items-center max-[820px]:grid-cols-1">
            <div>
              <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Affiliate</div>
              <h2 className="font-display text-[clamp(1.5rem,4vw,2.3rem)] font-extrabold mt-3 mb-3">{content["affiliate.title"]}</h2>
              <p className="text-dim text-[.98rem] leading-[1.95] mb-6">{content["affiliate.subtitle"]}</p>
              <Link
                href="/affiliate"
                className="inline-block font-body font-bold rounded-[14px] transition text-[.98rem] px-6 py-3 bg-gradient-to-br from-accent to-accent2 text-white shadow-[0_15px_40px_-15px_rgb(var(--c-accent)/.8)] hover:-translate-y-0.5"
              >
                {content["affiliate.button"]}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.14)] p-4 text-center">
                <div className="font-display text-[clamp(1.6rem,4vw,2.2rem)] font-extrabold text-cyan">
                  {toPersianDigits(affiliate.commissionPercent)}٪
                </div>
                <div className="text-dim text-[.8rem] mt-1">از هر سفارش زیرمجموعه</div>
              </div>
              <div className="rounded-2xl bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.14)] p-4 text-center">
                <div className="font-display text-[clamp(1.1rem,3vw,1.5rem)] font-extrabold text-primary2 leading-[1.6]">
                  {affiliate.minPayoutLabel}
                </div>
                <div className="text-dim text-[.8rem] mt-1">حداقل تسویه</div>
              </div>
              <div className="col-span-2 rounded-2xl bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.14)] p-4 text-[.85rem] text-dim leading-[1.9]">
                ثبت‌نام رایگان ← اشتراک لینک اختصاصی ← دریافت سهم از هر خرید
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[rgb(var(--c-primary2)/.14)] px-[5vw] py-10 text-center text-dim">
        <div className="inline-flex items-center gap-2.5 font-display font-extrabold text-text mb-2.5">
          <BrandLogo className="w-[26px] h-[26px]" />گت‌استوک
        </div>
        <p className="m-0">{content["footer.tagline"]}</p>
        {(content["footer.social_instagram"] || content["footer.social_telegram"]) && (
          <div className="flex items-center justify-center gap-4 mt-3 text-[.82rem]">
            {content["footer.social_instagram"] && (
              <a href={content["footer.social_instagram"]} target="_blank" rel="noopener noreferrer" className="text-dim hover:text-text transition">
                اینستاگرام
              </a>
            )}
            {content["footer.social_telegram"] && (
              <a href={content["footer.social_telegram"]} target="_blank" rel="noopener noreferrer" className="text-dim hover:text-text transition">
                تلگرام
              </a>
            )}
          </div>
        )}
        <div className="flex items-center justify-center gap-4 mt-3 text-[.82rem]">
          <a href="/p/about" className="text-dim hover:text-text transition">درباره ما</a>
          <a href="/p/terms" className="text-dim hover:text-text transition">قوانین و مقررات</a>
          <a href="/p/faq" className="text-dim hover:text-text transition">سؤالات متداول</a>
          <a href="/blog" className="text-dim hover:text-text transition">وبلاگ</a>
          <a href="/affiliate" className="text-dim hover:text-text transition">همکاری در فروش</a>
        </div>
        <p className="max-w-[60ch] mx-auto mt-4 text-[.78rem] text-muted leading-[1.85]"
          dangerouslySetInnerHTML={{
            __html: (content["footer.copyright"] || "").replace(
              /\(https?:\/\/[^\)]+\)/g,
              (match) => {
                const url = match.slice(1, -1);
                const domain = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="underline hover:text-text transition">${domain}</a>`;
              }
            ),
          }}
        />
      </footer>

      <OrderDrawer open={open} category={drawerCat} linkEntry={linkEntry} onClose={close} />
      <AuthModal open={authModalOpen} onClose={closeAuthModal} />
    </div>
  );
}
