"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { CATEGORIES, ALL_SITES, type Category } from "@/data/categories";
import { toPersianDigits } from "@/lib/money";
import { useLinkDetect } from "@/lib/useLinkDetect";
import { unsupportedSiteMessage, type LinkEntry } from "@/lib/linkDetect";
import OrderDrawer from "@/components/OrderDrawer";
import AuthModal from "@/components/AuthModal";
import SiteMarquee from "@/components/SiteMarquee";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

// صحنه‌ی سه‌بعدی فقط سمت کلاینت لود شود
const HeroScene = dynamic(() => import("@/components/HeroScene"), { ssr: false });

const STEPS = [
  { n: "01", title: "لینک را بفرست", desc: "آدرس محصول را از هر سایت پشتیبانی‌شده کپی کن و در فرم دسته‌ی مربوطه بگذار." },
  { n: "02", title: "پرداخت جزئی", desc: "قیمت خودکار محاسبه می‌شود؛ از کیف پول یا درگاه مبلغ ناچیزی می‌پردازی." },
  { n: "03", title: "فایل را بگیر", desc: "فایل اصلی و باکیفیت را دانلود کرده و در پنلت آماده‌ی دانلود قرار می‌دهیم." },
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

export default function HomeClient({ content }: { content: Record<string, string> }) {
  const [drawerCat, setDrawerCat] = useState<Category | null>(null);
  const [linkEntry, setLinkEntry] = useState<LinkEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [heroLink, setHeroLink] = useState("");
  const [heroError, setHeroError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, loading, logout, authModalOpen, openAuthModal, closeAuthModal } = useAuth();
  const heroDetection = useLinkDetect(heroLink);
  useReveal();

  const navItems = [
    [content["header.nav1_href"], content["header.nav1_label"]],
    [content["header.nav2_href"], content["header.nav2_label"]],
    [content["header.nav3_href"], content["header.nav3_label"]],
  ];

  const openCat = (c: Category) => { setDrawerCat(c); setLinkEntry(null); setOpen(true); };
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
            "radial-gradient(60vw 60vw at 80% -10%,rgba(107,91,255,.18),transparent 60%),radial-gradient(50vw 50vw at 0% 20%,rgba(56,225,255,.10),transparent 60%),radial-gradient(50vw 50vw at 50% 120%,rgba(255,107,53,.12),transparent 60%)",
        }}
      />

      {/* floating nav */}
      <nav className="fixed top-[14px] sm:top-[18px] left-1/2 -translate-x-1/2 z-[200] w-full max-w-[94vw] sm:w-auto">
        <div className="flex items-center gap-2 bg-[rgba(20,24,51,.7)] backdrop-blur-[20px] border border-[rgba(138,124,255,.14)] rounded-full py-2 px-3 sm:p-[8px_8px_8px_20px] shadow-[0_30px_80px_-30px_rgba(0,0,0,.75)]">
          <div className="flex items-center gap-2 sm:gap-2.5 font-display font-extrabold text-[1rem] sm:text-[1.15rem] whitespace-nowrap shrink-0">
            <span className="w-[28px] h-[28px] sm:w-[30px] sm:h-[30px] rounded-[9px] bg-gradient-to-br from-primary to-accent grid place-items-center shadow-[0_0_60px_-10px_#6B5BFF]">
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M3 12l7-2 2-7 2 7 7 2-7 2-2 7-2-7-7-2z" fill="#fff" />
              </svg>
            </span>
            مدیاجت
          </div>
          <div className="flex gap-1 mx-1.5 max-[760px]:hidden">
            {navItems.map(([href, label]) => (
              <a key={href} href={href} className="text-dim text-[.9rem] font-medium px-3.5 py-2 rounded-full transition hover:text-text hover:bg-[rgba(255,255,255,.05)] whitespace-nowrap">
                {label}
              </a>
            ))}
          </div>

          {/* desktop auth area */}
          <div className="max-[760px]:hidden">
            {!loading && user ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <Link
                  href="/dashboard"
                  className="text-text text-[.85rem] font-semibold px-3.5 py-2 rounded-full whitespace-nowrap transition hover:bg-[rgba(255,255,255,.05)]"
                >
                  پنل کاربری
                </Link>
                <span dir="ltr" className="text-text text-[.85rem] font-semibold px-3.5 py-2 whitespace-nowrap">
                  {user.mobile}
                </span>
                <button
                  onClick={logout}
                  className="font-body cursor-pointer border-none font-bold text-[.85rem] text-text bg-[rgba(255,255,255,.08)] px-4 py-2.5 rounded-full whitespace-nowrap shrink-0 transition hover:bg-[rgba(255,255,255,.16)]"
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
            className="min-[761px]:hidden mr-auto shrink-0 w-9 h-9 grid place-items-center rounded-full bg-[rgba(255,255,255,.06)] border border-[rgba(138,124,255,.14)] transition hover:bg-[rgba(255,255,255,.12)]"
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
          <div className="min-[761px]:hidden mt-2 bg-[rgba(20,24,51,.92)] backdrop-blur-[20px] border border-[rgba(138,124,255,.14)] rounded-[20px] p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,.75)] flex flex-col gap-1">
            {navItems.map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="text-text text-[.9rem] font-medium px-4 py-2.5 rounded-xl transition hover:bg-[rgba(255,255,255,.06)]"
              >
                {label}
              </a>
            ))}
            <div className="h-px bg-[rgba(138,124,255,.14)] my-1" />
            {!loading && user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="text-text text-[.9rem] font-semibold px-4 py-2.5 rounded-xl transition hover:bg-[rgba(255,255,255,.06)]"
                >
                  پنل کاربری
                </Link>
                <span dir="ltr" className="text-dim text-[.85rem] font-semibold px-4 py-1.5">
                  {user.mobile}
                </span>
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="font-body cursor-pointer border-none text-right font-bold text-[.9rem] text-text bg-[rgba(255,255,255,.08)] px-4 py-2.5 rounded-xl transition hover:bg-[rgba(255,255,255,.16)]"
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
          <span className="inline-flex items-center gap-2 text-[.82rem] font-semibold text-accent2 bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.25)] px-4 py-[7px] rounded-full mb-[26px]">
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
            <a href="#how" className="font-body cursor-pointer font-bold rounded-[14px] transition text-[1.05rem] px-8 py-4 bg-[rgba(255,255,255,.06)] text-text border border-[rgba(138,124,255,.14)] backdrop-blur-[10px] hover:bg-[rgba(255,255,255,.1)] hover:-translate-y-[3px]">
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
                className="flex-1 latin text-[.95rem] text-text bg-[rgba(10,12,26,.6)] border border-[rgba(138,124,255,.24)] rounded-xl p-[14px_16px] backdrop-blur-[10px] transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(107,91,255,.15)] outline-none"
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
            <div key={s.n} className="reveal bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-[20px] p-[32px_26px] transition hover:-translate-y-2 hover:border-[rgba(138,124,255,.5)]">
              <div className="latin text-[.85rem] font-bold text-accent w-10 h-10 rounded-xl bg-[rgba(255,107,53,.12)] grid place-items-center mb-5">{s.n}</div>
              <h3 className="font-display text-[1.25rem] mb-2">{s.title}</h3>
              <p className="text-dim text-[.95rem]">{s.desc}</p>
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
              className="reveal group relative bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-[18px] p-[24px_22px] cursor-pointer transition hover:-translate-y-1.5 hover:border-[rgba(56,225,255,.4)] hover:shadow-[0_20px_40px_-20px_rgba(56,225,255,.3)]"
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
            <a
              key={site}
              href="#cats"
              className="reveal group relative bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-[18px] p-[22px_18px] cursor-pointer transition hover:-translate-y-1.5 hover:border-[rgba(56,225,255,.4)] hover:shadow-[0_20px_40px_-20px_rgba(56,225,255,.3)]"
            >
              <div className="w-10 h-10 rounded-[10px] bg-[rgba(138,124,255,.14)] grid place-items-center text-[.75rem] font-latin font-bold text-cyan mb-3">
                {site.slice(0, 2)}
              </div>
              <h4 className="latin font-display text-[1rem] mb-1 truncate">{site}</h4>
              <div className="text-dim text-[.8rem]">{toPersianDigits(count)} دسته‌ی قابل سفارش</div>
            </a>
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
              className="reveal bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-[20px] p-[28px_24px] transition hover:-translate-y-1.5 hover:border-[rgba(138,124,255,.5)]"
            >
              <div className="latin text-accent2 text-[1.1rem] mb-3 tracking-[.1em]">
                {"★".repeat(t.stars)}
                <span className="text-[rgba(255,255,255,.15)]">{"★".repeat(5 - t.stars)}</span>
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
          <div className="reveal relative overflow-hidden rounded-[24px] p-[34px] shadow-[0_30px_80px_-30px_rgba(0,0,0,.75)]" style={{ background: "linear-gradient(135deg,#6B5BFF,#4536C7 70%,#FF6B35)" }}>
            <div className="absolute w-[220px] h-[220px] rounded-full bg-[rgba(255,255,255,.1)] -top-20 -left-[50px]" />
            <div className="absolute w-[140px] h-[140px] rounded-full bg-[rgba(255,255,255,.08)] -bottom-10 right-[20%]" />
            <div className="text-[rgba(255,255,255,.85)] text-[.9rem] relative">موجودی کیف پول</div>
            <div className="font-display text-[2.6rem] font-extrabold my-1.5 mb-[22px] relative" dir="rtl">
              {toPersianDigits(Math.round(Number(user?.walletBalanceRial ?? 0) / 10).toLocaleString("en-US"))}{" "}
              <small className="text-base font-medium">تومان</small>
            </div>
            <div className="flex gap-2.5 flex-wrap relative">
              {["۱۰۰٬۰۰۰", "۵۰۰٬۰۰۰", "۱٬۰۰۰٬۰۰۰"].map((v) => (
                <button key={v} className="font-body bg-[rgba(255,255,255,.16)] border-none text-white font-bold px-4 py-2.5 rounded-[11px] cursor-pointer transition hover:bg-[rgba(255,255,255,.32)] hover:-translate-y-0.5">
                  + {v}
                </button>
              ))}
            </div>
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

      {/* FOOTER */}
      <footer className="border-t border-[rgba(138,124,255,.14)] px-[5vw] py-10 text-center text-dim">
        <div className="inline-flex items-center gap-2.5 font-display font-extrabold text-text mb-2.5">
          <span className="w-[26px] h-[26px] rounded-lg bg-gradient-to-br from-primary to-accent" />مدیاجت
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
        </div>
        <p className="max-w-[60ch] mx-auto mt-4 text-[.78rem] text-[#5b6390] leading-[1.85]">
          {content["footer.copyright"]}
        </p>
      </footer>

      <OrderDrawer open={open} category={drawerCat} linkEntry={linkEntry} onClose={close} />
      <AuthModal open={authModalOpen} onClose={closeAuthModal} />
    </div>
  );
}
