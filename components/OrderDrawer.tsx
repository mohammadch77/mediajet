"use client";
import { Fragment, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CATEGORIES, categoryHasSite, categoryById, type Category } from "@/data/categories";
import { detectSite } from "@/lib/detectSite";
import { validateProductUrl } from "@/lib/productUrl";
import SiteLogo from "@/components/SiteLogo";
import type { LinkEntry } from "@/lib/linkDetect";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/CartContext";

interface Props {
  open: boolean;
  /** حالت قدیمی: کاربر روی کارت یک دسته کلیک کرده و باید سایت را انتخاب کند. */
  category: Category | null;
  /** حالت جدید: کاربر لینک را زودتر (مثلاً در صفحه‌ی اصلی) وارد کرده و سایت/دسته از رویش تشخیص داده شده. */
  linkEntry?: LinkEntry | null;
  onClose: () => void;
}

type Stage = "sites" | "pick-category" | "form";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

/** قیمت نهایی هر روش پرداخت؛ درصد کارمزد هرگز به کلاینت نمی‌رسد. */
type Quote = {
  walletPriceRial: bigint;
  gatewayPriceRial: bigint;
  walletPriceLabel: string;
  gatewayPriceLabel: string;
};

export default function OrderDrawer({ open, category, linkEntry, onClose }: Props) {
  const { requireAuth } = useAuth();
  const { bumpCount } = useCart();
  const [stage, setStage] = useState<Stage>("sites");
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [candidates, setCandidates] = useState<Category[]>([]);
  const [link, setLink] = useState("");
  const [detected, setDetected] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [addedItem, setAddedItem] = useState<{ categoryTitle: string; priceLabel: string } | null>(null);

  // دریافت قیمت از سرور (قیمت هرگز سمت کلاینت محاسبه نمی‌شود).
  // سرور قیمت نهایی هر دو روش پرداخت را می‌دهد؛ درصد کارمزد هیچ‌وقت فرستاده نمی‌شود.
  const fetchQuote = useCallback(async (catId: string, site: string) => {
    if (!catId || !site) { setQuote(null); return; }
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: catId, site }),
      });
      if (!res.ok) { setQuote(null); return; }
      const data = await res.json();
      setQuote({
        walletPriceRial: BigInt(data.walletPriceRial),
        gatewayPriceRial: BigInt(data.gatewayPriceRial),
        walletPriceLabel: data.walletPriceLabel,
        gatewayPriceLabel: data.gatewayPriceLabel,
      });
    } catch {
      setQuote(null);
    }
  }, []);

  // با باز شدن دراور از روی کارتِ یک دسته (جریان قدیمی): مرحله‌ی انتخاب سایت را نشان بده.
  useEffect(() => {
    if (open && category && !linkEntry) {
      setStage("sites");
      setSelectedCatId(category.id);
      setSelectedSite("");
      setCandidates([]);
      setLink("");
      setDetected("");
      setQuote(null);
      setSubmitStatus("idle");
      setSubmitError(null);
      setAddedItem(null);
    }
  }, [open, category, linkEntry]);

  // با باز شدن دراور از روی لینکِ از‌پیش‌تشخیص‌داده‌شده (فیلد صفحه‌ی اصلی یا لینک داخل خودِ دراور):
  // سایت مشخص است ولی دسته همیشه باید از خود کاربر پرسیده شود.
  useEffect(() => {
    if (open && linkEntry) {
      setSelectedSite(linkEntry.site);
      setLink(linkEntry.link);
      setDetected(linkEntry.site);
      setCandidates(linkEntry.candidates);
      setSubmitStatus("idle");
      setSubmitError(null);
      setAddedItem(null);
      setSelectedCatId("");
      setQuote(null);
      setStage("pick-category");
    }
  }, [open, linkEntry]);

  // بستن با Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const activeCat = categoryById(selectedCatId) ?? category ?? candidates[0] ?? null;

  const pickCategory = (id: string) => {
    setSelectedCatId(id);
    setStage("form");
    fetchQuote(id, selectedSite);
  };

  const selectSite = (site: string) => {
    setSelectedSite(site);
    setStage("form");
    fetchQuote(selectedCatId, site);
  };

  const onLinkInput = (v: string) => {
    setLink(v);
    const d = detectSite(v);
    setDetected(d);
    if (d && activeCat && categoryHasSite(activeCat, d)) {
      setSelectedSite(d);
      fetchQuote(selectedCatId, d);
    }
  };


  const onCategoryChange = (id: string) => {
    setSelectedCatId(id);
    const cat = categoryById(id);
    const site = cat && categoryHasSite(cat, selectedSite) ? selectedSite : "";
    setSelectedSite(site);
    fetchQuote(id, site);
  };

  const handleAddToCart = async () => {
    if (submitStatus === "submitting") return;
    setSubmitError(null);

    if (!selectedSite) {
      setSubmitError("سایت مبدأ را انتخاب کن.");
      return;
    }
    // همان اعتبارسنجی سمت سرور؛ لینک باید واقعاً مربوط به همین سایت و صفحه‌ی یک محصول باشد.
    const checkedLink = validateProductUrl(link, selectedSite);
    if (!checkedLink.ok) {
      setSubmitError(checkedLink.error);
      return;
    }

    setSubmitStatus("submitting");
    try {
      await requireAuth();
    } catch {
      // کاربر مودال ورود را بدون تکمیل ورود بست
      setSubmitStatus("idle");
      return;
    }

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCatId,
          site: selectedSite,
          productUrl: checkedLink.url,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitStatus("error");
        setSubmitError(data.error ?? "افزودن به سبد با خطا مواجه شد.");
        return;
      }

      setAddedItem({ categoryTitle: data.categoryTitle, priceLabel: data.priceLabel });
      setSubmitStatus("success");
      bumpCount();
    } catch {
      setSubmitStatus("error");
      setSubmitError("خطا در ارتباط با سرور. دوباره تلاش کن.");
    }
  };

  /** برای افزودن آیتم بعدی: فرم را با همان نقطه‌ی ورود (سایت/دسته) خالی می‌کند. */
  const addAnother = () => {
    setLink("");
    setSubmitStatus("idle");
    setSubmitError(null);
    setAddedItem(null);
    if (linkEntry) {
      setSelectedCatId("");
      setQuote(null);
      setStage("pick-category");
    } else if (category) {
      setSelectedSite("");
      setQuote(null);
      setStage("sites");
    }
  };

  if (!category && !linkEntry) return null;

  return (
    <>
      {/* scrim */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-[300] bg-[rgba(4,6,14,.6)] backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* drawer: side on desktop, bottom sheet on mobile */}
      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed z-[310] flex flex-col bg-gradient-to-b from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] shadow-[0_30px_80px_-30px_rgba(0,0,0,.75)] transition-transform duration-[420ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)]
          top-0 right-0 h-screen w-[min(460px,92vw)] rounded-r-none rounded-l-[24px]
          max-[640px]:top-auto max-[640px]:bottom-0 max-[640px]:left-0 max-[640px]:w-full max-[640px]:h-auto max-[640px]:max-h-[88vh] max-[640px]:rounded-t-[24px] max-[640px]:rounded-b-none
          ${open ? "translate-x-0 max-[640px]:translate-y-0" : "translate-x-[105%] max-[640px]:translate-x-0 max-[640px]:translate-y-[105%]"}`}
      >
        {/* handle (mobile) */}
        <div className="hidden max-[640px]:block w-11 h-[5px] rounded-full bg-[rgb(var(--c-primary2)/.14)] mx-auto mt-3" />

        {/* head */}
        <div className="flex items-start justify-between gap-3 p-[26px_26px_18px] border-b border-[rgb(var(--c-primary2)/.14)] shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {stage === "form" && !linkEntry && (
              <button
                onClick={() => setStage("sites")}
                aria-label="بازگشت به لیست سایت‌ها"
                className="bg-surface2 border border-[rgb(var(--c-primary2)/.14)] text-text w-9 h-9 rounded-[10px] cursor-pointer text-base shrink-0 mt-0.5 transition hover:border-cyan hover:text-cyan"
              >
                →
              </button>
            )}
            {stage === "pick-category" ? (
              <div className="min-w-0">
                <h3 className="font-display text-[1.4rem] mb-1">دسته‌ی محصول را انتخاب کن</h3>
                <div className="text-dim text-[.82rem] leading-[1.7]">
                  سایت شناسایی شد: <b className="text-cyan">{detected}</b>
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="text-3xl">{activeCat?.icon}</div>
                <h3 className="font-display text-[1.4rem] mb-1">{activeCat?.title}</h3>
                <div className="text-dim text-[.82rem] leading-[1.7]">
                  سایت‌ها:{" "}
                  {activeCat?.sites.map((s, i) => (
                    <Fragment key={s}>{i > 0 && " · "}<bdi className="whitespace-nowrap">{s}</bdi></Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="bg-surface2 border border-[rgb(var(--c-primary2)/.14)] text-text w-9 h-9 rounded-[10px] cursor-pointer text-[1.1rem] shrink-0 transition hover:bg-accent hover:border-accent"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="p-[24px_26px] overflow-y-auto flex-1">
          {stage === "pick-category" ? (
            <>
              <div className="text-dim text-[.9rem] mb-4">
                دسته‌ی محصول را انتخاب کن تا قیمت دقیق را نشان بدهیم.
              </div>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => pickCategory(c.id)}
                    className="flex items-center gap-2.5 bg-surface border border-[rgb(var(--c-primary2)/.14)] rounded-xl p-3 cursor-pointer transition hover:border-[rgb(var(--c-cyan)/.5)] hover:-translate-y-0.5"
                  >
                    <div className="text-xl shrink-0">{c.icon}</div>
                    <div className="text-[.88rem] font-bold">{c.title}</div>
                  </div>
                ))}
              </div>
            </>
          ) : stage === "sites" ? (
            <>
              <div className="text-dim text-[.9rem] mb-4">فایلت را از کدام سایت می‌خواهی؟</div>
              <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
                {activeCat?.sites.map((site) => (
                  <div
                    key={site}
                    onClick={() => selectSite(site)}
                    className="flex items-center gap-2.5 bg-surface border border-[rgb(var(--c-primary2)/.14)] rounded-xl p-3 cursor-pointer transition hover:border-[rgb(var(--c-cyan)/.5)] hover:-translate-y-0.5"
                  >
                    <SiteLogo site={site} className="w-[34px] h-[34px] rounded-[10px] text-[.7rem]" />
                    <div className="latin text-[.88rem] font-bold">{site}</div>
                  </div>
                ))}
              </div>
            </>
          ) : submitStatus === "success" && addedItem ? (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className="w-16 h-16 rounded-full bg-[rgb(var(--c-cyan)/.12)] border border-[rgb(var(--c-cyan)/.4)] grid place-items-center text-3xl">✓</div>
              <h4 className="font-display text-[1.25rem]">به سبد اضافه شد</h4>
              <p className="text-dim text-[.9rem]">
                <b className="text-text">{addedItem.categoryTitle}</b> — <b className="text-primary2">{addedItem.priceLabel}</b>
              </p>
              <div className="flex gap-2.5 flex-wrap justify-center mt-4">
                <button
                  onClick={addAnother}
                  className="font-body cursor-pointer border-none font-bold rounded-[14px] transition text-[.95rem] px-5 py-3 bg-[rgb(var(--c-ov)/.08)] text-text hover:bg-[rgb(var(--c-ov)/.16)]"
                >
                  افزودن آیتم دیگر
                </button>
                <Link
                  href="/cart"
                  onClick={onClose}
                  className="font-body cursor-pointer font-bold rounded-[14px] transition text-[.95rem] px-5 py-3 bg-gradient-to-br from-primary to-primary2 text-white hover:-translate-y-px"
                >
                  رفتن به سبد خرید ←
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-[18px]">
                <label className="block font-semibold mb-2 text-[.92rem]">دسته‌ی محصول</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full font-body text-[.95rem] text-text bg-bg border border-[rgb(var(--c-primary2)/.14)] rounded-xl p-[14px_15px] cursor-pointer focus:border-primary outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="mb-[18px]">
                <label className="block font-semibold mb-2 text-[.92rem]">سایت مبدأ</label>
                <select
                  value={selectedSite}
                  onChange={(e) => { setSelectedSite(e.target.value); fetchQuote(selectedCatId, e.target.value); }}
                  className="w-full font-body text-[.95rem] text-text bg-bg border border-[rgb(var(--c-primary2)/.14)] rounded-xl p-[14px_15px] cursor-pointer focus:border-primary outline-none"
                >
                  <option value="">— انتخاب کن —</option>
                  {activeCat?.sites.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-2 text-[.92rem]">لینک محصول</label>
                <input
                  value={link}
                  onChange={(e) => onLinkInput(e.target.value)}
                  type="text"
                  placeholder="https://..."
                  className="w-full latin text-[.95rem] text-text bg-bg border border-[rgb(var(--c-primary2)/.14)] rounded-xl p-[14px_15px] transition focus:border-primary focus:shadow-[0_0_0_3px_rgb(var(--c-primary)/.15)] outline-none"
                />
                <div className="text-[.82rem] text-dim mt-2 min-h-[20px]">
                  {detected ? (
                    <>سایت شناسایی شد: <b className="text-cyan">{detected}</b> ✓</>
                  ) : link ? (
                    "سایت شناسایی نشد — لینک کامل محصول را وارد کن."
                  ) : ""}
                </div>
              </div>
            </>
          )}
        </div>

        {/* footer (form stage) */}
        {stage === "form" && submitStatus !== "success" && (
          <div className="p-[16px_26px_22px] border-t border-[rgb(var(--c-primary2)/.14)] shrink-0 bg-bg2">
            {!quote ? (
              <div className="flex items-center justify-between bg-[rgb(var(--c-primary)/.08)] border border-dashed border-[rgb(var(--c-primary2)/.4)] rounded-[14px] p-[16px_20px] mb-3.5">
                <span>هزینه‌ی تخمینی</span>
                <span className="font-display text-[1.5rem] font-extrabold text-primary2">—</span>
              </div>
            ) : (
              <div className="mb-3.5 bg-[rgb(var(--c-primary)/.08)] border border-[rgb(var(--c-primary2)/.2)] rounded-[14px] p-[16px_20px]">
                <div className="text-[.82rem] text-dim mb-1.5">هزینه‌ی این آیتم (بسته به روش پرداخت در سبد)</div>
                <div className="flex items-center gap-2 flex-wrap font-display font-extrabold text-[1.15rem]">
                  <span className="text-success">{quote.walletPriceLabel}</span>
                  <span className="text-dim text-[.85rem] font-normal">تا</span>
                  <span className="text-primary2">{quote.gatewayPriceLabel}</span>
                </div>
                <div className="text-[.72rem] text-dim mt-1.5">
                  روش پرداخت (کیف پول یا درگاه) را در صفحه‌ی سبد خرید انتخاب می‌کنی.
                </div>
              </div>
            )}
            {submitError && (
              <div className="text-[.85rem] text-accent2 mb-3 text-center leading-[1.8]">{submitError}</div>
            )}
            <button
              onClick={handleAddToCart}
              disabled={submitStatus === "submitting"}
              className="w-full font-body cursor-pointer border-none font-bold rounded-[14px] transition text-[1.05rem] p-4 bg-gradient-to-br from-accent to-accent2 text-white shadow-[0_12px_30px_-10px_#FF6B35] hover:-translate-y-[3px] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {submitStatus === "submitting" ? "در حال افزودن..." : "افزودن به سبد"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
