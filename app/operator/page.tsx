"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, ITEM_STATUS_LABELS, canTransition, type OrderStatus, type OrderItemStatus } from "@/lib/orderState";
import { CATEGORIES } from "@/data/categories";

type OperatorItem = {
  id: string;
  index: number;
  category: string;
  sourceSite: string;
  productUrl: string;
  status: OrderItemStatus;
  deliveryUrl: string | null;
  isLarge: boolean;
  hasStoredFile: boolean;
  fileName: string | null;
};

type OperatorOrder = {
  id: string;
  orderNumber: string;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  user: { id: string; mobile: string; name: string | null };
  items: OperatorItem[];
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
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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
    setBusyOrderId(orderId);
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
      setBusyOrderId(null);
    }
  }

  async function deliverByLink(orderId: string, itemId: string) {
    const fileUrl = (linkDrafts[itemId] ?? "").trim();
    if (!fileUrl) {
      setError("لینک فایل تحویلی را وارد کن.");
      return;
    }
    setBusyItemId(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/items/${itemId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در ثبت تحویل آیتم.");
      }
      setLinkDrafts((d) => ({ ...d, [itemId]: "" }));
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت تحویل آیتم.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function deliverByUpload(orderId: string, itemId: string) {
    const input = fileInputRefs.current[itemId];
    const file = input?.files?.[0];
    if (!file) {
      setError("یک فایل برای آپلود انتخاب کن.");
      return;
    }
    setBusyItemId(itemId);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/operator/orders/${orderId}/items/${itemId}/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در آپلود فایل آیتم.");
      }
      if (input) input.value = "";
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در آپلود فایل آیتم.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function markLarge(orderId: string, itemId: string) {
    setBusyItemId(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/items/${itemId}/large`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در علامت‌گذاری فایل بزرگ.");
      }
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در علامت‌گذاری فایل بزرگ.");
    } finally {
      setBusyItemId(null);
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
        <div className="grid grid-cols-1 gap-3.5">
          {orders.map((o) => {
            const nextStatuses = ALL_STATUSES.filter((s) => canTransition(o.status, s));
            const isOrderBusy = busyOrderId === o.id;
            return (
              <div
                key={o.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-[18px] sm:p-[20px_22px]"
              >
                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <span className="font-display font-bold">
                        سفارش <span dir="ltr" className="latin">{o.orderNumber}</span>
                      </span>
                      <span className="px-3 py-1.5 rounded-full text-[.8rem] font-bold bg-[rgba(255,255,255,.06)] border border-[rgba(138,124,255,.14)]">
                        {STATUS_LABELS[o.status]}
                      </span>
                      <span className="text-dim text-[.78rem]">
                        {o.items.length} آیتم
                      </span>
                    </div>
                    <div className="text-dim text-[.78rem]">
                      کاربر: {o.user.name ?? o.user.mobile} ({o.user.mobile}) — {toJalaliDateTime(o.createdAt)}
                    </div>
                  </div>
                  <span className="font-semibold text-[.95rem] shrink-0">{o.priceLabel}</span>
                </div>

                {nextStatuses.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {nextStatuses.map((s) => (
                      <button
                        key={s}
                        disabled={isOrderBusy}
                        onClick={() => changeStatus(o.id, s)}
                        className="font-body cursor-pointer border-none font-bold text-[.82rem] text-white bg-gradient-to-br from-primary to-primary2 px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isOrderBusy ? "..." : `→ ${STATUS_LABELS[s]}`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  {o.items.map((item) => {
                    const isItemBusy = busyItemId === item.id;
                    const canDeliverItem = item.status === "pending";
                    return (
                      <div
                        key={item.id}
                        className="bg-[rgba(255,255,255,.03)] border border-[rgba(138,124,255,.1)] rounded-xl p-3.5 sm:p-4"
                      >
                        <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[.78rem] font-bold text-cyan">آیتم {item.index}</span>
                              <span className="font-semibold text-[.88rem]">{categoryTitle(item.category)}</span>
                              <span className="text-dim text-[.78rem]">{item.sourceSite}</span>
                              <span className="px-2.5 py-1 rounded-full text-[.72rem] font-bold bg-[rgba(255,255,255,.06)] border border-[rgba(138,124,255,.14)]">
                                {ITEM_STATUS_LABELS[item.status]}
                              </span>
                              {item.isLarge && (
                                <span className="px-2.5 py-1 rounded-full text-[.72rem] font-bold bg-[rgba(255,107,53,.12)] border border-[rgba(255,107,53,.3)] text-accent2">
                                  فایل بزرگ
                                </span>
                              )}
                            </div>
                            <a
                              href={item.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              dir="ltr"
                              className="text-dim text-[.76rem] block truncate max-w-full sm:max-w-[420px] hover:text-cyan transition"
                            >
                              {item.productUrl}
                            </a>
                          </div>
                        </div>

                        {canDeliverItem && (
                          <div className="flex flex-col gap-2 mt-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="url"
                                dir="ltr"
                                placeholder="لینک فایل تحویلی"
                                value={linkDrafts[item.id] ?? ""}
                                onChange={(e) => setLinkDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                                className="bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-4 py-2 text-[.8rem] flex-1 w-full sm:min-w-[200px] sm:w-auto outline-none focus:border-cyan"
                              />
                              <button
                                disabled={isItemBusy}
                                onClick={() => deliverByLink(o.id, item.id)}
                                className="font-body cursor-pointer border-none font-bold text-[.78rem] text-white bg-[rgba(56,225,255,.16)] text-cyan px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                              >
                                ثبت لینک
                              </button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="file"
                                ref={(el) => {
                                  fileInputRefs.current[item.id] = el;
                                }}
                                className="text-[.76rem] text-dim flex-1 w-full sm:w-auto file:ml-2 file:rounded-full file:border-0 file:bg-[rgba(138,124,255,.16)] file:text-text file:px-3 file:py-1.5 file:text-[.76rem] file:cursor-pointer"
                              />
                              <button
                                disabled={isItemBusy}
                                onClick={() => deliverByUpload(o.id, item.id)}
                                className="font-body cursor-pointer border-none font-bold text-[.78rem] text-white bg-gradient-to-br from-primary to-primary2 px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                              >
                                {isItemBusy ? "..." : "آپلود فایل (حداکثر ۲۰ مگابایت)"}
                              </button>
                              <button
                                disabled={isItemBusy}
                                onClick={() => markLarge(o.id, item.id)}
                                className="font-body cursor-pointer border border-[rgba(255,107,53,.3)] font-bold text-[.78rem] text-accent2 bg-transparent px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                              >
                                علامت به‌عنوان فایل بزرگ
                              </button>
                            </div>
                          </div>
                        )}

                        {!canDeliverItem && item.deliveryUrl && (
                          <div className="text-dim text-[.76rem] mt-1.5">
                            لینک فعلی:{" "}
                            <a href={item.deliveryUrl} target="_blank" rel="noreferrer" dir="ltr" className="text-cyan hover:underline">
                              {item.deliveryUrl}
                            </a>
                          </div>
                        )}
                        {!canDeliverItem && item.hasStoredFile && (
                          <div className="text-dim text-[.76rem] mt-1.5">
                            فایل ذخیره‌شده: {item.fileName ?? "—"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
