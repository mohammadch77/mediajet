"use client";
import { useEffect, useState, useCallback } from "react";
import { CATEGORIES, categoryById, type Category } from "@/data/categories";
import { detectSite } from "@/lib/detectSite";
import type { LinkEntry } from "@/lib/linkDetect";
import { useAuth } from "@/lib/AuthContext";

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

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function OrderDrawer({ open, category, linkEntry, onClose }: Props) {
  const { requireAuth, setWalletBalance } = useAuth();
  const [stage, setStage] = useState<Stage>("sites");
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [candidates, setCandidates] = useState<Category[]>([]);
  const [link, setLink] = useState("");
  const [detected, setDetected] = useState("");
  const [priceLabel, setPriceLabel] = useState("—");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{ orderId: string; priceLabel: string; walletBalanceRial: string | null } | null>(null);

  // دریافت قیمت از سرور (قیمت هرگز سمت کلاینت محاسبه نمی‌شود)
  const fetchQuote = useCallback(async (catId: string, site: string) => {
    if (!catId || !site) { setPriceLabel("—"); return; }
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: catId, site }),
      });
      if (!res.ok) { setPriceLabel("—"); return; }
      const data = await res.json();
      setPriceLabel(data.label ?? "—");
    } catch {
      setPriceLabel("—");
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
      setPriceLabel("—");
      setIdempotencyKey(newIdempotencyKey());
      setSubmitStatus("idle");
      setSubmitError(null);
      setOrderResult(null);
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
      setOrderResult(null);
      setIdempotencyKey(newIdempotencyKey());
      setSelectedCatId("");
      setPriceLabel("—");
      setStage("pick-category");
    }
  }, [open, linkEntry]);

  // اگر پارامترهای سفارش تغییر کند، کلید یکتای درخواست هم عوض شود تا با درخواست قبلی تداخل نکند.
  useEffect(() => {
    if (submitStatus === "idle") {
      setIdempotencyKey(newIdempotencyKey());
    }
  }, [selectedCatId, selectedSite, link]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (d && activeCat?.sites.includes(d)) {
      setSelectedSite(d);
      fetchQuote(selectedCatId, d);
    }
  };


  const onCategoryChange = (id: string) => {
    setSelectedCatId(id);
    const cat = categoryById(id);
    const site = cat && cat.sites.includes(selectedSite) ? selectedSite : "";
    setSelectedSite(site);
    fetchQuote(id, site);
  };

  const handleSubmit = async () => {
    if (submitStatus === "submitting") return;
    setSubmitError(null);

    if (!link.trim()) {
      setSubmitError("لینک محصول را وارد کن.");
      return;
    }
    if (!selectedSite) {
      setSubmitError("سایت مبدأ را انتخاب کن.");
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
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCatId,
          site: selectedSite,
          productUrl: link,
          paymentMethod: "wallet",
          idempotencyKey,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSubmitStatus("error");
        setSubmitError(
          data.error === "موجودی کیف پول کافی نیست."
            ? "موجودی کیف پول کافی نیست. لطفاً ابتدا کیف پول را شارژ کن."
            : data.error ?? "ثبت سفارش با خطا مواجه شد.",
        );
        return;
      }

      setOrderResult({ orderId: data.orderId, priceLabel: data.priceLabel, walletBalanceRial: data.walletBalanceRial });
      setSubmitStatus("success");
      if (data.walletBalanceRial) {
        setWalletBalance(data.walletBalanceRial);
      }
    } catch {
      setSubmitStatus("error");
      setSubmitError("خطا در ارتباط با سرور. دوباره تلاش کن.");
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
        className={`fixed z-[310] flex flex-col bg-gradient-to-b from-surface to-bg2 border border-[rgba(138,124,255,.14)] shadow-[0_30px_80px_-30px_rgba(0,0,0,.75)] transition-transform duration-[420ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)]
          top-0 right-0 h-screen w-[min(460px,92vw)] rounded-r-none rounded-l-[24px]
          max-[640px]:top-auto max-[640px]:bottom-0 max-[640px]:left-0 max-[640px]:w-full max-[640px]:h-auto max-[640px]:max-h-[88vh] max-[640px]:rounded-t-[24px] max-[640px]:rounded-b-none
          ${open ? "translate-x-0 max-[640px]:translate-y-0" : "translate-x-[105%] max-[640px]:translate-x-0 max-[640px]:translate-y-[105%]"}`}
      >
        {/* handle (mobile) */}
        <div className="hidden max-[640px]:block w-11 h-[5px] rounded-full bg-[rgba(138,124,255,.14)] mx-auto mt-3" />

        {/* head */}
        <div className="flex items-start justify-between gap-3 p-[26px_26px_18px] border-b border-[rgba(138,124,255,.14)] shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {stage === "form" && !linkEntry && (
              <button
                onClick={() => setStage("sites")}
                aria-label="بازگشت به لیست سایت‌ها"
                className="bg-surface2 border border-[rgba(138,124,255,.14)] text-text w-9 h-9 rounded-[10px] cursor-pointer text-base shrink-0 mt-0.5 transition hover:border-cyan hover:text-cyan"
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
                  سایت‌ها: {activeCat?.sites.join(" · ")}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="بستن"
            className="bg-surface2 border border-[rgba(138,124,255,.14)] text-text w-9 h-9 rounded-[10px] cursor-pointer text-[1.1rem] shrink-0 transition hover:bg-accent hover:border-accent"
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
                    className="flex items-center gap-2.5 bg-surface border border-[rgba(138,124,255,.14)] rounded-xl p-3 cursor-pointer transition hover:border-[rgba(56,225,255,.5)] hover:-translate-y-0.5"
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
                    className="flex items-center gap-2.5 bg-surface border border-[rgba(138,124,255,.14)] rounded-xl p-3 cursor-pointer transition hover:border-[rgba(56,225,255,.5)] hover:-translate-y-0.5"
                  >
                    <div className="w-[34px] h-[34px] rounded-[10px] bg-bg2 grid place-items-center text-[.7rem] font-latin font-bold shrink-0">
                      {site.slice(0, 2)}
                    </div>
                    <div className="latin text-[.88rem] font-bold">{site}</div>
                  </div>
                ))}
              </div>
            </>
          ) : submitStatus === "success" && orderResult ? (
            <div className="flex flex-col items-center text-center py-8 gap-3">
              <div className="w-16 h-16 rounded-full bg-[rgba(56,225,255,.12)] border border-[rgba(56,225,255,.4)] grid place-items-center text-3xl">✓</div>
              <h4 className="font-display text-[1.25rem]">سفارش با موفقیت ثبت شد</h4>
              <p className="text-dim text-[.9rem]">
                شماره‌ی سفارش: <b dir="ltr" className="text-cyan latin">{orderResult.orderId}</b>
              </p>
              <p className="text-dim text-[.9rem]">مبلغ پرداخت‌شده: <b className="text-primary2">{orderResult.priceLabel}</b></p>
              {orderResult.walletBalanceRial && (
                <p className="text-dim text-[.85rem]">
                  موجودی جدید کیف پول: {" "}
                  <b className="text-text">{Math.round(Number(orderResult.walletBalanceRial) / 10).toLocaleString("en-US")} تومان</b>
                </p>
              )}
              <button
                onClick={onClose}
                className="mt-4 font-body cursor-pointer border-none font-bold rounded-[14px] transition text-[.95rem] px-6 py-3 bg-[rgba(255,255,255,.08)] text-text hover:bg-[rgba(255,255,255,.16)]"
              >
                بستن
              </button>
            </div>
          ) : (
            <>
              <div className="mb-[18px]">
                <label className="block font-semibold mb-2 text-[.92rem]">دسته‌ی محصول</label>
                <select
                  value={selectedCatId}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="w-full font-body text-[.95rem] text-text bg-bg border border-[rgba(138,124,255,.14)] rounded-xl p-[14px_15px] cursor-pointer focus:border-primary outline-none"
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
                  className="w-full font-body text-[.95rem] text-text bg-bg border border-[rgba(138,124,255,.14)] rounded-xl p-[14px_15px] cursor-pointer focus:border-primary outline-none"
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
                  className="w-full latin text-[.95rem] text-text bg-bg border border-[rgba(138,124,255,.14)] rounded-xl p-[14px_15px] transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(107,91,255,.15)] outline-none"
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
          <div className="p-[16px_26px_22px] border-t border-[rgba(138,124,255,.14)] shrink-0 bg-bg2">
            <div className="flex items-center justify-between bg-[rgba(107,91,255,.08)] border border-dashed border-[rgba(138,124,255,.4)] rounded-[14px] p-[16px_20px] mb-3.5">
              <span>هزینه‌ی تخمینی</span>
              <span className="font-display text-[1.5rem] font-extrabold text-primary2">{priceLabel}</span>
            </div>
            {submitError && (
              <div className="text-[.85rem] text-accent2 mb-3 text-center leading-[1.8]">{submitError}</div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitStatus === "submitting"}
              className="w-full font-body cursor-pointer border-none font-bold rounded-[14px] transition text-[1.05rem] p-4 bg-gradient-to-br from-accent to-accent2 text-white shadow-[0_12px_30px_-10px_#FF6B35] hover:-translate-y-[3px] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {submitStatus === "submitting" ? "در حال ثبت..." : "ثبت و پرداخت سفارش"}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
