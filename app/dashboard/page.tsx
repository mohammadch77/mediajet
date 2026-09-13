"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { toPersianDigits } from "@/lib/money";
import { toJalaliDate, toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orderState";
import { CATEGORIES } from "@/data/categories";

type Order = {
  id: string;
  category: string;
  sourceSite: string;
  productUrl: string;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  downloadUrl: string | null;
};

type WalletTx = {
  id: string;
  type: "credit" | "debit";
  amountLabel: string;
  balanceAfterLabel: string;
  note: string | null;
  createdAt: string;
};

type WalletData = { balanceLabel: string; transactions: WalletTx[] };

function categoryTitle(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.title ?? id;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, openAuthModal } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chargeNotice, setChargeNotice] = useState<"success" | "failed" | null>(null);
  const [chargeAmountToman, setChargeAmountToman] = useState("");
  const [charging, setCharging] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);

  async function loadDashboard() {
    try {
      const [ordersRes, walletRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/wallet"),
      ]);
      if (!ordersRes.ok || !walletRes.ok) {
        throw new Error("خطا در دریافت اطلاعات پنل.");
      }
      const ordersData = await ordersRes.json();
      const walletData = await walletRes.json();
      setOrders(ordersData.orders);
      setWallet(walletData);
    } catch {
      setError("دریافت اطلاعات با خطا مواجه شد. دوباره تلاش کن.");
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openAuthModal();
      router.replace("/");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const charge = params.get("charge");
    if (charge === "success" || charge === "failed") {
      setChargeNotice(charge);
      router.replace("/dashboard");
    }

    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, router, openAuthModal]);

  async function handleCharge() {
    setChargeError(null);
    const toman = Number(chargeAmountToman);
    if (!Number.isInteger(toman) || toman <= 0) {
      setChargeError("مبلغ را به تومان و به‌صورت عدد صحیح وارد کن.");
      return;
    }

    setCharging(true);
    try {
      const res = await fetch("/api/wallet/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRial: toman * 10 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در شروع شارژ کیف پول.");
      }
      window.location.href = data.redirectUrl;
    } catch (e) {
      setChargeError(e instanceof Error ? e.message : "خطا در شروع شارژ کیف پول.");
      setCharging(false);
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
    <div className="relative min-h-screen px-[5vw] py-16 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Dashboard</div>
          <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-2">پنل کاربری</h1>
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

      {chargeNotice === "success" && (
        <div className="bg-[rgba(56,225,255,.1)] border border-[rgba(56,225,255,.3)] text-cyan rounded-2xl p-4 mb-8">
          شارژ کیف پول با موفقیت انجام شد.
        </div>
      )}
      {chargeNotice === "failed" && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-8">
          شارژ کیف پول ناموفق بود یا لغو شد.
        </div>
      )}

      {/* WALLET */}
      <section className="mb-14">
        <h2 className="font-display text-[1.3rem] font-bold mb-4">کیف پول</h2>
        {!wallet ? (
          <div className="text-dim">در حال بارگذاری...</div>
        ) : (
          <>
            <div
              className="rounded-[20px] p-[26px_30px] mb-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,.75)]"
              style={{ background: "linear-gradient(135deg,#6B5BFF,#4536C7 70%,#FF6B35)" }}
            >
              <div className="text-[rgba(255,255,255,.85)] text-[.9rem]">موجودی فعلی</div>
              <div className="font-display text-[2.2rem] font-extrabold mt-1.5" dir="rtl">
                {wallet.balanceLabel}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap mb-2">
              <input
                type="number"
                min={1}
                placeholder="مبلغ به تومان"
                value={chargeAmountToman}
                onChange={(e) => setChargeAmountToman(e.target.value)}
                className="bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-4 py-2.5 text-[.9rem] w-[180px] outline-none focus:border-cyan"
              />
              <button
                onClick={handleCharge}
                disabled={charging}
                className="font-body cursor-pointer border-none font-bold text-[.9rem] text-white bg-gradient-to-br from-primary to-primary2 px-5 py-2.5 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {charging ? "در حال انتقال..." : "شارژ کیف پول"}
              </button>
            </div>
            {chargeError && (
              <div className="text-accent2 text-[.82rem] mb-6">{chargeError}</div>
            )}

            {wallet.transactions.length === 0 ? (
              <div className="text-dim text-[.9rem]">هنوز تراکنشی ثبت نشده است.</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[rgba(138,124,255,.14)]">
                <table className="w-full text-[.88rem] border-collapse min-w-[560px]">
                  <thead>
                    <tr className="bg-[rgba(255,255,255,.04)] text-dim text-right">
                      <th className="p-3.5 font-semibold">نوع</th>
                      <th className="p-3.5 font-semibold">مبلغ</th>
                      <th className="p-3.5 font-semibold">موجودی پس از تراکنش</th>
                      <th className="p-3.5 font-semibold">توضیح</th>
                      <th className="p-3.5 font-semibold">تاریخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallet.transactions.map((t) => (
                      <tr key={t.id} className="border-t border-[rgba(138,124,255,.1)]">
                        <td className="p-3.5">
                          <span
                            className={
                              "px-2.5 py-1 rounded-full text-[.78rem] font-bold " +
                              (t.type === "credit"
                                ? "bg-[rgba(56,225,255,.12)] text-cyan"
                                : "bg-[rgba(255,107,53,.12)] text-accent2")
                            }
                          >
                            {t.type === "credit" ? "شارژ" : "پرداخت"}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold">
                          {t.type === "credit" ? "+ " : "- "}
                          {t.amountLabel}
                        </td>
                        <td className="p-3.5 text-dim">{t.balanceAfterLabel}</td>
                        <td className="p-3.5 text-dim">{t.note ?? "—"}</td>
                        <td className="p-3.5 text-dim whitespace-nowrap">{toJalaliDateTime(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* ORDERS */}
      <section>
        <h2 className="font-display text-[1.3rem] font-bold mb-4">سفارش‌های من</h2>
        {!orders ? (
          <div className="text-dim">در حال بارگذاری...</div>
        ) : orders.length === 0 ? (
          <div className="text-dim text-[.9rem]">هنوز سفارشی ثبت نکرده‌ای.</div>
        ) : (
          <div className="grid gap-3.5">
            {orders.map((o) => (
              <div
                key={o.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-[20px_22px] flex items-center justify-between flex-wrap gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <span className="font-display font-bold">{categoryTitle(o.category)}</span>
                    <span className="text-dim text-[.82rem]">{o.sourceSite}</span>
                  </div>
                  <a
                    href={o.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="text-dim text-[.78rem] block truncate max-w-[360px] hover:text-cyan transition"
                  >
                    {o.productUrl}
                  </a>
                  <div className="text-dim text-[.78rem] mt-1.5">{toJalaliDate(o.createdAt)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-[.95rem]">{o.priceLabel}</span>
                  <span className="px-3 py-1.5 rounded-full text-[.8rem] font-bold bg-[rgba(255,255,255,.06)] border border-[rgba(138,124,255,.14)]">
                    {STATUS_LABELS[o.status]}
                  </span>
                  {o.downloadUrl && (
                    <a
                      href={o.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-body cursor-pointer border-none font-bold text-[.85rem] text-white bg-gradient-to-br from-primary to-primary2 px-4 py-2.5 rounded-full whitespace-nowrap transition hover:-translate-y-px"
                    >
                      دانلود
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
