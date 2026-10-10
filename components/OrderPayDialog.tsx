"use client";
// انتخاب روش پرداخت برای یک سفارش «در انتظار پرداخت»: کیف پول (با کارمزد کمتر) یا درگاه آنلاین.
// قیمت و موجودی از سرور می‌آید و پرداخت هم سمت سرور دوباره محاسبه می‌شود.

import { useEffect, useState } from "react";
import { LEGAL_LINKS } from "@/lib/legal";

type Quote = {
  walletTotalRial: string;
  walletTotalLabel: string;
  gatewayTotalLabel: string;
  walletBalanceRial: string;
  walletBalanceLabel: string;
};

export default function OrderPayDialog({
  orderId,
  onClose,
  onPaid,
  onGoWallet,
  onStale,
}: {
  orderId: string;
  onClose: () => void;
  /** پرداخت با کیف پول موفق بود */
  onPaid: () => void;
  onGoWallet: () => void;
  /** سفارش دیگر قابل پرداخت نیست (لیست باید تازه شود) */
  onStale: () => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [method, setMethod] = useState<"wallet" | "gateway">("gateway");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // بستن با Esc (مگر وقتی پرداخت در جریان است)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${orderId}/pay`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 409 || res.status === 404) onStale();
          throw new Error(json.error ?? "دریافت قیمت سفارش ناموفق بود.");
        }
        if (cancelled) return;
        setQuote(json);
        setMethod(BigInt(json.walletBalanceRial) >= BigInt(json.walletTotalRial) ? "wallet" : "gateway");
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "دریافت قیمت سفارش ناموفق بود."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const enough = quote ? BigInt(quote.walletBalanceRial) >= BigInt(quote.walletTotalRial) : false;

  async function pay() {
    if (!quote || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (method === "wallet") {
        const res = await fetch(`/api/orders/${orderId}/pay-wallet`, { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 409) onStale();
          throw new Error(json.error ?? "پرداخت از کیف پول ناموفق بود؛ دوباره تلاش کن.");
        }
        onPaid();
        return;
      }
      const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) onStale();
        throw new Error(json.error ?? "ایجاد پرداخت ناموفق بود؛ دوباره تلاش کن.");
      }
      window.location.href = json.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "پرداخت ناموفق بود؛ دوباره تلاش کن.");
      setBusy(false);
    }
  }

  const card = (active: boolean, disabled: boolean) =>
    "w-full text-right rounded-xl border p-4 transition " +
    (disabled
      ? "opacity-60 cursor-not-allowed border-[rgb(var(--c-primary2)/.15)]"
      : active
        ? "border-primary2 bg-[rgb(var(--c-primary)/.12)] cursor-pointer"
        : "border-[rgb(var(--c-primary2)/.2)] cursor-pointer hover:border-primary2");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:px-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-dialog-title"
        className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[460px] max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="pay-dialog-title" className="font-display font-bold text-lg">روش پرداخت</h3>
          <button onClick={onClose} disabled={busy} className="text-dim hover:text-text px-2" aria-label="بستن">✕</button>
        </div>

        {!quote && !error && <p className="text-dim text-[.86rem]">در حال دریافت قیمت...</p>}
        {error && (
          <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-xl p-3 mb-4 text-[.84rem]">{error}</div>
        )}

        {quote && (
          <>
            <div className="space-y-3 mb-4">
              <button type="button" disabled={!enough} onClick={() => setMethod("wallet")} className={card(method === "wallet", !enough)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-[.92rem]">پرداخت از کیف پول</span>
                  <span className="font-display font-extrabold text-success">{quote.walletTotalLabel}</span>
                </div>
                <div className="text-dim text-[.76rem] mt-1.5">موجودی شما: {quote.walletBalanceLabel}</div>
                {!enough && <div className="text-accent2 text-[.76rem] mt-1">موجودی کافی نیست؛ اول کیف پول را شارژ کن.</div>}
              </button>

              <button type="button" onClick={() => setMethod("gateway")} className={card(method === "gateway", false)}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-[.92rem]">پرداخت آنلاین (درگاه بانکی)</span>
                  <span className="font-display font-extrabold">{quote.gatewayTotalLabel}</span>
                </div>
                <div className="text-dim text-[.76rem] mt-1.5">به درگاه پرداخت منتقل می‌شوی.</div>
              </button>
            </div>

            <button
              type="button"
              onClick={pay}
              disabled={busy || (method === "wallet" && !enough)}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-br from-primary to-primary-deep transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? "..." : method === "wallet" ? "پرداخت از کیف پول" : "رفتن به درگاه پرداخت"}
            </button>
            <p className="text-dim text-[.76rem] leading-[1.8] mt-3 text-center">
              با پرداخت، <a href={LEGAL_LINKS.terms.href} target="_blank" rel="noopener noreferrer" className="text-cyan underline">{LEGAL_LINKS.terms.label}</a> و{" "}
              <a href={LEGAL_LINKS.refund.href} target="_blank" rel="noopener noreferrer" className="text-cyan underline">{LEGAL_LINKS.refund.label}</a> را می‌پذیری.
            </p>
            {!enough && (
              <button type="button" onClick={onGoWallet} className="w-full mt-2 py-2.5 rounded-xl text-[.84rem] font-bold text-dim border border-[rgb(var(--c-primary2)/.25)]">
                شارژ کیف پول
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
