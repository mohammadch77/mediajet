"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, canTransition, type OrderStatus } from "@/lib/orderState";
import { CATEGORIES } from "@/data/categories";

type OperatorOrder = {
  id: string;
  category: string;
  sourceSite: string;
  productUrl: string;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  user: { id: string; mobile: string; name: string | null };
  deliveryUrl: string | null;
};

const ALL_STATUSES: OrderStatus[] = [
  "draft",
  "awaiting_payment",
  "queued",
  "processing",
  "ready",
  "delivered",
  "cancelled",
  "failed",
  "refunded",
];

function categoryTitle(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.title ?? id;
}

export default function OperatorPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<OperatorOrder[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deliverDrafts, setDeliverDrafts] = useState<Record<string, string>>({});

  async function loadOrders() {
    setError(null);
    try {
      const url = statusFilter ? `/api/operator/orders?status=${statusFilter}` : "/api/operator/orders";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در دریافت صف سفارش‌ها.");
      }
      setOrders(data.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت صف سفارش‌ها.");
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "operator") {
      router.replace("/");
      return;
    }
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, router, statusFilter]);

  async function changeStatus(orderId: string, toStatus: OrderStatus) {
    setBusyId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در تغییر وضعیت.");
      }
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در تغییر وضعیت.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitDelivery(orderId: string) {
    const fileUrl = (deliverDrafts[orderId] ?? "").trim();
    if (!fileUrl) {
      setError("لینک فایل تحویلی را وارد کن.");
      return;
    }
    setBusyId(orderId);
    setError(null);
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در ثبت تحویل.");
      }
      setDeliverDrafts((d) => ({ ...d, [orderId]: "" }));
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت تحویل.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !user || user.role !== "operator") {
    return (
      <div className="min-h-screen grid place-items-center text-dim">
        در حال بررسی دسترسی...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-[5vw] py-16 max-w-[1300px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Operator</div>
          <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-2">پنل اپراتور</h1>
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

      <div className="flex items-center gap-2.5 flex-wrap mb-6">
        <button
          onClick={() => setStatusFilter("")}
          className={
            "px-3.5 py-1.5 rounded-full text-[.82rem] font-bold border transition " +
            (statusFilter === ""
              ? "bg-gradient-to-br from-primary to-primary2 text-white border-transparent"
              : "bg-[rgba(255,255,255,.04)] border-[rgba(138,124,255,.2)] text-dim hover:text-text")
          }
        >
          همه
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={
              "px-3.5 py-1.5 rounded-full text-[.82rem] font-bold border transition " +
              (statusFilter === s
                ? "bg-gradient-to-br from-primary to-primary2 text-white border-transparent"
                : "bg-[rgba(255,255,255,.04)] border-[rgba(138,124,255,.2)] text-dim hover:text-text")
            }
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {!orders ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : orders.length === 0 ? (
        <div className="text-dim text-[.9rem]">سفارشی در این وضعیت وجود ندارد.</div>
      ) : (
        <div className="grid gap-3.5">
          {orders.map((o) => {
            const nextStatuses = ALL_STATUSES.filter((s) => canTransition(o.status, s));
            const canDeliver = canTransition(o.status, "ready");
            const isBusy = busyId === o.id;
            return (
              <div
                key={o.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-[20px_22px]"
              >
                <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <span className="font-display font-bold">{categoryTitle(o.category)}</span>
                      <span className="text-dim text-[.82rem]">{o.sourceSite}</span>
                      <span className="px-3 py-1.5 rounded-full text-[.8rem] font-bold bg-[rgba(255,255,255,.06)] border border-[rgba(138,124,255,.14)]">
                        {STATUS_LABELS[o.status]}
                      </span>
                    </div>
                    <a
                      href={o.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      dir="ltr"
                      className="text-dim text-[.78rem] block truncate max-w-[480px] hover:text-cyan transition"
                    >
                      {o.productUrl}
                    </a>
                    <div className="text-dim text-[.78rem] mt-1.5">
                      کاربر: {o.user.name ?? o.user.mobile} ({o.user.mobile}) — {toJalaliDateTime(o.createdAt)}
                    </div>
                  </div>
                  <span className="font-semibold text-[.95rem] shrink-0">{o.priceLabel}</span>
                </div>

                {nextStatuses.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {nextStatuses.map((s) => (
                      <button
                        key={s}
                        disabled={isBusy}
                        onClick={() => changeStatus(o.id, s)}
                        className="font-body cursor-pointer border-none font-bold text-[.82rem] text-white bg-gradient-to-br from-primary to-primary2 px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isBusy ? "..." : `→ ${STATUS_LABELS[s]}`}
                      </button>
                    ))}
                  </div>
                )}

                {canDeliver && (
                  <div className="flex items-center gap-2.5 flex-wrap mt-2">
                    <input
                      type="url"
                      dir="ltr"
                      placeholder="لینک فایل تحویلی"
                      value={deliverDrafts[o.id] ?? ""}
                      onChange={(e) => setDeliverDrafts((d) => ({ ...d, [o.id]: e.target.value }))}
                      className="bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-4 py-2 text-[.82rem] flex-1 w-full sm:min-w-[220px] sm:w-auto outline-none focus:border-cyan"
                    />
                    <button
                      disabled={isBusy}
                      onClick={() => submitDelivery(o.id)}
                      className="font-body cursor-pointer border-none font-bold text-[.82rem] text-white bg-[rgba(56,225,255,.16)] text-cyan px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      ثبت تحویل و آماده‌سازی
                    </button>
                  </div>
                )}

                {o.deliveryUrl && (
                  <div className="text-dim text-[.78rem] mt-2">
                    لینک فعلی:{" "}
                    <a href={o.deliveryUrl} target="_blank" rel="noreferrer" dir="ltr" className="text-cyan hover:underline">
                      {o.deliveryUrl}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
