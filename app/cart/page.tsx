"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/CartContext";

type CartItem = {
  id: string;
  categoryId: string;
  categoryTitle: string;
  sourceSite: string;
  productUrl: string;
  priceLabel: string;
};

type CartQuote = {
  itemCount: number;
  walletTotalRial: string;
  gatewayTotalRial: string;
  walletTotalLabel: string;
  gatewayTotalLabel: string;
};

type PaymentMethod = "wallet" | "gateway";

export default function CartPage() {
  const router = useRouter();
  const { user, loading, openAuthModal } = useAuth();
  const { refresh: refreshCartBadge } = useCart();
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [walletBalanceRial, setWalletBalanceRial] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const loadCart = useCallback(async () => {
    setError(null);
    try {
      const [itemsRes, quoteRes, walletRes] = await Promise.all([
        fetch("/api/cart"),
        fetch("/api/cart/quote"),
        fetch("/api/wallet"),
      ]);
      if (!itemsRes.ok) throw new Error("خطا در دریافت سبد خرید.");
      const itemsData = await itemsRes.json();
      setItems(itemsData.items);

      if (walletRes.ok) {
        const walletData = await walletRes.json();
        setWalletBalanceRial(BigInt(walletData.balanceRial));
      }

      if (itemsData.items.length === 0) {
        setQuote(null);
      } else if (quoteRes.ok) {
        setQuote(await quoteRes.json());
      }
    } catch {
      setError("دریافت سبد خرید با خطا مواجه شد. دوباره تلاش کن.");
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openAuthModal();
      router.replace("/");
      return;
    }
    loadCart();
  }, [loading, user, router, openAuthModal, loadCart]);

  const hasEnoughWalletBalance =
    quote && walletBalanceRial !== null ? walletBalanceRial >= BigInt(quote.walletTotalRial) : null;

  // پیش‌فرض کیف پول است، مگر موجودی کافی نباشد؛ با بارگذاری/تغییر جمع سبد دوباره ارزیابی می‌شود.
  useEffect(() => {
    if (hasEnoughWalletBalance === false) {
      setPaymentMethod("gateway");
    } else if (hasEnoughWalletBalance === true) {
      setPaymentMethod("wallet");
    }
  }, [hasEnoughWalletBalance]);

  async function handleCheckout() {
    if (checkingOut) return;
    setCheckoutError(null);
    setCheckingOut(true);
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, idempotencyKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "پرداخت سبد خرید با خطا مواجه شد.");
      }

      refreshCartBadge();

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (data.status === "queued") {
        router.push("/dashboard?order=success");
        return;
      }

      throw new Error("وضعیت سفارش نامشخص است. برای پیگیری به پنل کاربری مراجعه کن.");
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : "پرداخت سبد خرید با خطا مواجه شد.");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleRemove(id: string) {
    if (removingId) return;
    setRemovingId(id);
    try {
      const res = await fetch(`/api/cart/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadCart();
      refreshCartBadge();
    } catch {
      setError("حذف آیتم با خطا مواجه شد. دوباره تلاش کن.");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-dim">
        در حال بررسی ورود...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-[5vw] py-16 max-w-[800px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Cart</div>
          <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-2">سبد خرید</h1>
        </div>
        <Link href="/" className="text-dim text-[.9rem] hover:text-text transition">
          ← بازگشت به صفحه‌ی اصلی
        </Link>
      </div>

      {error && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-8">
          {error}
        </div>
      )}

      {!items ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">🛒</div>
          <p className="text-dim mb-6">سبد خریدت خالی است.</p>
          <Link
            href="/#cats"
            className="inline-block font-body font-bold rounded-[14px] transition text-[.95rem] px-6 py-3 bg-gradient-to-br from-primary to-primary2 text-white hover:-translate-y-px"
          >
            شروع کن و آیتم اضافه کن
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3.5 mb-8">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-[18px_20px] flex items-center justify-between flex-wrap gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <span className="font-display font-bold">{item.categoryTitle}</span>
                    <span className="text-dim text-[.82rem] latin">{item.sourceSite}</span>
                  </div>
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="text-dim text-[.78rem] block truncate max-w-[360px] hover:text-cyan transition"
                  >
                    {item.productUrl}
                  </a>
                </div>
                <div className="flex items-center gap-3 flex-wrap shrink-0">
                  <span className="font-semibold text-[.95rem]">{item.priceLabel}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={removingId === item.id}
                    aria-label="حذف از سبد"
                    className="font-body cursor-pointer border-none font-bold text-[.82rem] text-accent2 bg-[rgba(255,107,53,.1)] px-3.5 py-2 rounded-full whitespace-nowrap transition hover:bg-[rgba(255,107,53,.2)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {removingId === item.id ? "..." : "حذف"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {quote && (
            <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-[22px_24px] mb-6">
              <div className="text-dim text-[.85rem] mb-3">جمع کل ({quote.itemCount} آیتم) — روش پرداخت را انتخاب کن</div>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 mb-1">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("wallet")}
                  className={
                    "text-right rounded-[14px] p-3.5 bg-[rgba(61,220,132,.1)] border-2 transition cursor-pointer " +
                    (paymentMethod === "wallet" ? "border-[#3ddc84]" : "border-[rgba(61,220,132,.25)]")
                  }
                >
                  <div className="flex items-center gap-2 text-[.78rem] text-[#3ddc84] font-bold mb-1">
                    پرداخت از کیف پول
                    <span className="px-2 py-0.5 rounded-full bg-[rgba(61,220,132,.2)] text-[.72rem]">ارزان‌تر</span>
                  </div>
                  <div className="font-display text-[1.2rem] font-extrabold text-[#3ddc84]">{quote.walletTotalLabel}</div>
                  {hasEnoughWalletBalance === false && (
                    <div className="text-[.76rem] text-accent2 mt-1.5">
                      موجودی کیف پول کافی نیست؛ از پنل کاربری شارژ کن یا از درگاه پرداخت کن.
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("gateway")}
                  className={
                    "text-right rounded-[14px] p-3.5 bg-[rgba(107,91,255,.1)] border-2 transition cursor-pointer " +
                    (paymentMethod === "gateway" ? "border-primary2" : "border-[rgba(138,124,255,.3)]")
                  }
                >
                  <div className="text-[.78rem] text-primary2 font-bold mb-1">پرداخت مستقیم از درگاه</div>
                  <div className="font-display text-[1.2rem] font-extrabold text-primary2">{quote.gatewayTotalLabel}</div>
                </button>
              </div>
            </div>
          )}

          {checkoutError && (
            <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-6 text-[.9rem]">
              {checkoutError}
            </div>
          )}

          <button
            type="button"
            onClick={handleCheckout}
            disabled={checkingOut || !quote || (paymentMethod === "wallet" && hasEnoughWalletBalance === false)}
            className="w-full font-body cursor-pointer border-none font-bold rounded-[14px] transition text-[1.05rem] p-4 bg-gradient-to-br from-accent to-accent2 text-white shadow-[0_12px_30px_-10px_#FF6B35] hover:-translate-y-[3px] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {checkingOut ? "در حال پرداخت..." : "ادامه به پرداخت"}
          </button>
        </>
      )}
    </div>
  );
}
