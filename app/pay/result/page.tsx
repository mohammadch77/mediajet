"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { toJalaliDateTime } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/money";

type PaymentResult = {
  kind: "charge" | "order";
  status: "verified" | "failed" | "pending";
  amountLabel: string;
  refId: string | null;
  createdAt: string;
  orderNumber: string | null;
};

type View =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "result"; result: PaymentResult };

const STATUS_STYLE = {
  verified: { icon: "✓", box: "bg-[rgb(var(--c-cyan)/.12)] text-cyan", title: "پرداخت موفق بود" },
  failed: { icon: "✕", box: "bg-[rgb(var(--c-accent)/.12)] text-accent2", title: "پرداخت ناموفق بود" },
  pending: { icon: "…", box: "bg-[rgb(var(--c-primary)/.14)] text-primary2", title: "نتیجه هنوز قطعی نشده" },
} as const;

function messageFor(result: PaymentResult): string {
  const isOrder = result.kind === "order";
  if (result.status === "verified") {
    return isOrder
      ? "پرداخت سفارش تأیید شد و سفارش در صف پردازش قرار گرفت."
      : "شارژ کیف پول با موفقیت انجام شد و مبلغ به موجودی شما اضافه شد.";
  }
  if (result.status === "failed") {
    return isOrder
      ? "پرداخت انجام نشد یا لغو شد. سفارش در وضعیت «در انتظار پرداخت» باقی می‌ماند و می‌توانی دوباره تلاش کنی."
      : "پرداخت انجام نشد یا لغو شد. مبلغی از کیف پول شما کم یا زیاد نشده است.";
  }
  return "تأیید پرداخت با درگاه هنوز قطعی نشده است. اگر مبلغ از حساب شما کسر شده، چند دقیقه صبر کنید و سپس با پشتیبانی تماس بگیرید.";
}

export default function PaymentResultPage() {
  const { user, loading, openAuthModal } = useAuth();
  const [view, setView] = useState<View>({ state: "loading" });
  const [fromCart, setFromCart] = useState(false);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    setFromCart(params.get("from") === "cart");

    const authority = params.get("a");
    if (!authority) {
      // بازگشت بدون شناسه‌ی پرداخت (مثلاً پارامتر درگاه ناقص بوده)
      setView({ state: "error", message: "اطلاعات پرداخت از درگاه دریافت نشد. اگر مبلغی کسر شده، با پشتیبانی تماس بگیر." });
      return;
    }
    if (!user) {
      setView({ state: "error", message: "برای دیدن نتیجه‌ی پرداخت باید وارد حساب کاربری شوی." });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/payments/result?authority=${encodeURIComponent(authority)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "دریافت نتیجه‌ی پرداخت با خطا مواجه شد.");
        setView({ state: "result", result: data });
      } catch (e) {
        setView({ state: "error", message: e instanceof Error ? e.message : "دریافت نتیجه‌ی پرداخت با خطا مواجه شد." });
      }
    })();
  }, [loading, user]);

  const linkBase =
    "text-center font-body font-bold rounded-[14px] transition text-[.95rem] px-5 py-3 hover:-translate-y-px";
  const primaryLink = linkBase + " bg-gradient-to-br from-primary to-primary-deep text-white";
  const secondaryLink = linkBase + " border border-[rgb(var(--c-primary2)/.3)] text-text";

  return (
    <div className="relative min-h-screen px-[5vw] py-10 sm:py-16 max-w-[560px] mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <Link href="/" className="text-dim text-[.9rem] hover:text-text transition">
          ← صفحه‌ی اصلی
        </Link>
        <ThemeToggle />
      </div>

      <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-6 sm:p-8 text-center">
        {view.state === "loading" && <div className="text-dim py-8">در حال دریافت نتیجه‌ی پرداخت...</div>}

        {view.state === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-5 rounded-full grid place-items-center text-3xl bg-[rgb(var(--c-accent)/.12)] text-accent2">!</div>
            <p className="text-dim mb-6 leading-[1.9]">{view.message}</p>
            {!user && !loading ? (
              <button
                type="button"
                onClick={openAuthModal}
                className={primaryLink + " w-full cursor-pointer border-none"}
              >
                ورود به حساب کاربری
              </button>
            ) : (
              <Link href="/dashboard" className={primaryLink + " block"}>
                رفتن به پنل کاربری
              </Link>
            )}
          </>
        )}

        {view.state === "result" && (
          <>
            <div className={"w-16 h-16 mx-auto mb-5 rounded-full grid place-items-center text-3xl font-bold " + STATUS_STYLE[view.result.status].box}>
              {STATUS_STYLE[view.result.status].icon}
            </div>
            <h1 className="font-display text-[1.4rem] font-extrabold mb-2">{STATUS_STYLE[view.result.status].title}</h1>
            <p className="text-dim text-[.92rem] leading-[1.9] mb-6">{messageFor(view.result)}</p>

            <dl className="text-right text-[.9rem] grid gap-2.5 mb-7 border-t border-[rgb(var(--c-primary2)/.12)] pt-5">
              <div className="flex justify-between gap-4">
                <dt className="text-dim">نوع پرداخت</dt>
                <dd className="font-semibold">{view.result.kind === "order" ? "پرداخت سفارش" : "شارژ کیف پول"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-dim">مبلغ</dt>
                <dd className="font-semibold">{view.result.amountLabel}</dd>
              </div>
              {view.result.orderNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-dim">شماره‌ی سفارش</dt>
                  <dd dir="ltr" className="latin font-semibold">{view.result.orderNumber}</dd>
                </div>
              )}
              {view.result.refId && (
                <div className="flex justify-between gap-4">
                  <dt className="text-dim">کد پیگیری</dt>
                  <dd dir="ltr" className="latin font-semibold">{toPersianDigits(view.result.refId)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-dim">زمان</dt>
                <dd className="font-semibold">{toJalaliDateTime(view.result.createdAt)}</dd>
              </div>
            </dl>

            <div className="flex flex-col min-[420px]:flex-row gap-3">
              {view.result.kind === "order" ? (
                <>
                  <Link href="/dashboard?tab=orders" className={primaryLink + " flex-1"}>
                    سفارش‌های من
                  </Link>
                  {view.result.status !== "verified" && (
                    <Link href="/cart" className={secondaryLink + " flex-1"}>
                      بازگشت به سبد خرید
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link href={fromCart ? "/cart" : "/dashboard?tab=wallet"} className={primaryLink + " flex-1"}>
                    {fromCart ? "بازگشت به سبد خرید" : "کیف پول من"}
                  </Link>
                  {fromCart && (
                    <Link href="/dashboard?tab=wallet" className={secondaryLink + " flex-1"}>
                      کیف پول من
                    </Link>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
