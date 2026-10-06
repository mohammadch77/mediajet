"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, ITEM_STATUS_LABELS, operatorCanTransition, type OrderStatus, type OrderItemStatus } from "@/lib/orderState";
import { CATEGORIES, categoryHasSite, categoryTitle, sitePriceRial } from "@/data/categories";
import { rialToTomanLabel } from "@/lib/money";

type OperatorItem = {
  id: string;
  index: number;
  category: string;
  sourceSite: string;
  productUrl: string;
  priceRial: number;
  refundedRial: number;
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

export default function OperatorPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<OperatorOrder[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  // پنل «دسته‌ی اشتباه»: همزمان فقط برای یک آیتم باز است.
  const [mismatchItemId, setMismatchItemId] = useState<string | null>(null);
  const [mismatchCategory, setMismatchCategory] = useState("");
  const [mismatchNote, setMismatchNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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

  function openMismatch(itemId: string) {
    setMismatchItemId(itemId);
    setMismatchCategory("");
    setMismatchNote("");
    setError(null);
  }

  async function submitMismatch(orderId: string, item: OperatorItem) {
    if (!mismatchCategory) {
      setError("دسته‌ی درست را انتخاب کن.");
      return;
    }
    const newPrice = sitePriceRial(mismatchCategory, item.sourceSite) ?? 0;
    const refund = newPrice > item.priceRial;
    const msg = refund
      ? `دسته‌ی درست گران‌تر است؛ این آیتم لغو و مبلغ آن به کیف پول کاربر برگردانده می‌شود و کاربر باید دوباره ثبت کند. ادامه می‌دهی؟`
      : "دسته‌ی این آیتم به دسته‌ی درست اصلاح می‌شود (بدون بازگشت وجه). ادامه می‌دهی؟";
    if (!window.confirm(msg)) return;

    setBusyItemId(item.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/operator/orders/${orderId}/items/${item.id}/category-mismatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctCategory: mismatchCategory, note: mismatchNote.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا در ثبت دسته‌ی اشتباه.");
      setNotice(
        data.kind === "refunded"
          ? `آیتم لغو شد و ${rialToTomanLabel(data.refundedRial)} به کیف پول کاربر برگشت.`
          : "دسته‌ی آیتم اصلاح شد.",
      );
      setMismatchItemId(null);
      await loadOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ثبت دسته‌ی اشتباه.");
    } finally {
      setBusyItemId(null);
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
        <div className="flex items-center gap-4">
          <Link href="/" className="text-dim text-[.9rem] hover:text-text transition">
            ← بازگشت به صفحه‌ی اصلی
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {notice && (
        <div className="bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.3)] rounded-2xl p-4 mb-8">{notice}</div>
      )}
      {error && (
        <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 mb-8">
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
              : "bg-[rgb(var(--c-ov)/.04)] border-[rgb(var(--c-primary2)/.2)] text-dim hover:text-text")
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
                : "bg-[rgb(var(--c-ov)/.04)] border-[rgb(var(--c-primary2)/.2)] text-dim hover:text-text")
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
            const nextStatuses = ALL_STATUSES.filter((s) => operatorCanTransition(o.status, s));
            const isOrderBusy = busyOrderId === o.id;
            return (
              <div
                key={o.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-[18px] sm:p-[20px_22px]"
              >
                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <span className="font-display font-bold">
                        سفارش <span dir="ltr" className="latin">{o.orderNumber}</span>
                      </span>
                      <span className="px-3 py-1.5 rounded-full text-[.8rem] font-bold bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)]">
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
                        className="bg-[rgb(var(--c-ov)/.03)] border border-[rgb(var(--c-primary2)/.1)] rounded-xl p-3.5 sm:p-4"
                      >
                        <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[.78rem] font-bold text-cyan">آیتم {item.index}</span>
                              <span className="font-semibold text-[.88rem]">{categoryTitle(item.category)}</span>
                              <span className="text-dim text-[.78rem]">{item.sourceSite}</span>
                              <span className="px-2.5 py-1 rounded-full text-[.72rem] font-bold bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)]">
                                {ITEM_STATUS_LABELS[item.status]}
                              </span>
                              {item.isLarge && (
                                <span className="px-2.5 py-1 rounded-full text-[.72rem] font-bold bg-[rgb(var(--c-accent)/.12)] border border-[rgb(var(--c-accent)/.3)] text-accent2">
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
                                className="bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-4 py-2 text-[.8rem] flex-1 w-full sm:min-w-[200px] sm:w-auto outline-none focus:border-cyan"
                              />
                              <button
                                disabled={isItemBusy}
                                onClick={() => deliverByLink(o.id, item.id)}
                                className="font-body cursor-pointer border-none font-bold text-[.78rem] text-white bg-[rgb(var(--c-cyan)/.16)] text-cyan px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
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
                                className="text-[.76rem] text-dim flex-1 w-full sm:w-auto file:ml-2 file:rounded-full file:border-0 file:bg-[rgb(var(--c-primary2)/.16)] file:text-text file:px-3 file:py-1.5 file:text-[.76rem] file:cursor-pointer"
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
                                className="font-body cursor-pointer border border-[rgb(var(--c-accent)/.3)] font-bold text-[.78rem] text-accent2 bg-transparent px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
                              >
                                علامت به‌عنوان فایل بزرگ
                              </button>
                              <button
                                disabled={isItemBusy}
                                onClick={() => (mismatchItemId === item.id ? setMismatchItemId(null) : openMismatch(item.id))}
                                className="font-body cursor-pointer border border-[rgb(var(--c-primary2)/.3)] font-bold text-[.78rem] text-text bg-transparent px-4 py-2 rounded-full transition hover:-translate-y-px disabled:opacity-50"
                              >
                                دسته‌ی اشتباه است
                              </button>
                            </div>

                            {mismatchItemId === item.id && (
                              <div className="mt-1 rounded-xl border border-[rgb(var(--c-accent)/.3)] bg-[rgb(var(--c-accent)/.06)] p-3 flex flex-col gap-2.5">
                                <div className="text-[.78rem] text-dim leading-[1.8]">
                                  دسته‌ی ثبت‌شده: <b className="text-text">{categoryTitle(item.category)}</b>. دسته‌ی درست را انتخاب کن.
                                  اگر قیمتش بیشتر نباشد فقط دسته اصلاح می‌شود، وگرنه این آیتم لغو و مبلغش به کیف پول کاربر برمی‌گردد.
                                </div>
                                <select
                                  value={mismatchCategory}
                                  onChange={(e) => setMismatchCategory(e.target.value)}
                                  className="bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-4 py-2 text-[.82rem] outline-none focus:border-cyan"
                                >
                                  <option value="" className="bg-bg2">انتخاب دسته‌ی درست…</option>
                                  {CATEGORIES.filter((c) => c.id !== item.category && categoryHasSite(c, item.sourceSite)).map((c) => (
                                    <option key={c.id} value={c.id} className="bg-bg2">
                                      {c.title}
                                    </option>
                                  ))}
                                </select>
                                {mismatchCategory && (
                                  <div className="text-[.78rem] font-bold">
                                    {(sitePriceRial(mismatchCategory, item.sourceSite) ?? 0) > item.priceRial
                                      ? "⚠️ قیمت دسته‌ی درست بیشتر است: آیتم لغو و مبلغ به کیف پول برمی‌گردد."
                                      : "✅ قیمت بیشتر نمی‌شود: فقط دسته اصلاح می‌شود."}
                                  </div>
                                )}
                                <input
                                  type="text"
                                  maxLength={300}
                                  placeholder="یادداشت (اختیاری)"
                                  value={mismatchNote}
                                  onChange={(e) => setMismatchNote(e.target.value)}
                                  className="bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-4 py-2 text-[.8rem] outline-none focus:border-cyan"
                                />
                                <div className="flex gap-2 flex-wrap">
                                  <button
                                    disabled={isItemBusy || !mismatchCategory}
                                    onClick={() => submitMismatch(o.id, item)}
                                    className="font-body cursor-pointer border-none font-bold text-[.8rem] text-white bg-gradient-to-br from-primary to-primary2 px-5 py-2 rounded-full disabled:opacity-50"
                                  >
                                    {isItemBusy ? "..." : "ثبت دسته‌ی درست"}
                                  </button>
                                  <button
                                    onClick={() => setMismatchItemId(null)}
                                    className="font-body cursor-pointer bg-transparent border border-[rgb(var(--c-primary2)/.2)] text-dim font-bold text-[.8rem] px-5 py-2 rounded-full"
                                  >
                                    انصراف
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {item.status === "rejected" && (
                          <div className="text-accent2 text-[.76rem] mt-1.5">
                            لغو شد (دسته‌ی اشتباه){item.refundedRial > 0 ? ` — ${rialToTomanLabel(item.refundedRial)} به کیف پول برگشت` : ""}
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
