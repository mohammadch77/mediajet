"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, ITEM_STATUS_LABELS, isRefundable, type OrderStatus, type OrderItemStatus } from "@/lib/orderState";

type OrderDetailItem = {
  id: string;
  position: number;
  categoryTitle: string;
  sourceSite: string;
  productUrl: string;
  status: OrderItemStatus;
  refundedLabel: string | null;
  mismatch: { from: string; to: string | null; note: string | null } | null;
  delivery: { fileUrl: string | null; fileName: string | null; isLarge: boolean; deliveredAt: string } | null;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  items: OrderDetailItem[];
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  user: { id: string; mobile: string; name: string | null };
  events: { id: string; fromStatus: string | null; toStatus: string; actor: string; note: string | null; createdAt: string }[];
};

function RefundBox({ orderId, priceLabel, onDone }: { orderId: string; priceLabel: string; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refund() {
    if (!confirm(`مبلغ ${priceLabel} به کیف پول کاربر برگردد؟ این کار قابل برگشت نیست.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "بازگشت وجه ناموفق بود.");
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "بازگشت وجه ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[rgb(var(--c-accent)/.06)] border border-[rgb(var(--c-accent)/.25)] rounded-2xl p-5 mb-6">
      <h2 className="font-display font-bold mb-1">بازگشت وجه</h2>
      <p className="text-dim text-[.82rem] mb-3 leading-[1.9]">
        کل مبلغ سفارش ({priceLabel}) به کیف پول کاربر برمی‌گردد و اگر این سفارش برای همکار معرف کمیسیون ساخته بود،
        همان کمیسیون هم برگشت می‌خورد.
      </p>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="دلیل بازگشت وجه (به کاربر نمایش داده نمی‌شود)"
          className="flex-1 min-w-0 font-body text-[.9rem] text-text bg-bg border border-[rgb(var(--c-primary2)/.14)] rounded-xl p-[10px_12px] focus:border-primary outline-none"
        />
        <button
          onClick={refund}
          disabled={busy}
          className="font-bold rounded-xl px-5 py-2.5 text-[.9rem] bg-[rgb(var(--c-accent)/.16)] text-accent2 border border-[rgb(var(--c-accent)/.35)] hover:bg-[rgb(var(--c-accent)/.26)] disabled:opacity-60 shrink-0"
        >
          {busy ? "در حال انجام..." : "بازگشت وجه"}
        </button>
      </div>
      {err && <div className="text-accent2 text-[.82rem] mt-2">{err}</div>}
    </div>
  );
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/orders/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت سفارش.");
      setOrder(json.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت سفارش.");
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4">
        {error}
      </div>
    );
  }

  if (!order) {
    return <div className="text-dim">در حال بارگذاری...</div>;
  }

  return (
    <div>
      <Link href="/admin/orders" className="text-dim text-[.85rem] hover:text-text transition mb-4 inline-block">
        ← بازگشت به لیست سفارش‌ها
      </Link>

      <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h1 className="font-display text-xl font-extrabold">
            <span dir="ltr" className="latin">{order.orderNumber}</span> · {order.items[0]?.categoryTitle ?? "—"}
            {order.items.length > 1 && <span className="text-dim text-[.85rem] font-normal"> (+{order.items.length - 1} آیتم دیگر)</span>}
          </h1>
          <span className="px-3 py-1.5 rounded-full text-[.8rem] font-bold bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)]">
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[.85rem]">
          <div><span className="text-dim">مبلغ: </span>{order.priceLabel}</div>
          <div>
            <span className="text-dim">کاربر: </span>
            <Link href={`/admin/users/${order.user.id}`} className="text-cyan hover:underline" dir="ltr">
              {order.user.mobile}
            </Link>
            {order.user.name && <span className="text-dim"> ({order.user.name})</span>}
          </div>
          <div><span className="text-dim">ثبت: </span>{toJalaliDateTime(order.createdAt)}</div>
          <div><span className="text-dim">آخرین به‌روزرسانی: </span>{toJalaliDateTime(order.updatedAt)}</div>
        </div>

        <div className="mt-4 pt-4 border-t border-[rgb(var(--c-primary2)/.14)] flex flex-col gap-3">
          {order.items.map((item, i) => (
            <div key={item.id} className="rounded-xl border border-[rgb(var(--c-primary2)/.14)] bg-[rgb(var(--c-ov)/.03)] p-3.5 text-[.85rem]">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <div className="font-display font-bold">
                  {order.items.length > 1 && <span className="text-dim font-normal">آیتم {i + 1} · </span>}
                  {item.categoryTitle}
                  <span className="text-dim font-normal"> · {item.sourceSite}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[.72rem] font-bold bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)]">
                  {ITEM_STATUS_LABELS[item.status]}
                </span>
              </div>
              <div className="min-w-0 mb-1">
                <span className="text-dim">لینک محصول: </span>
                <a href={item.productUrl} target="_blank" rel="noreferrer noopener" dir="ltr" className="text-cyan hover:underline break-all">
                  {item.productUrl}
                </a>
              </div>
              {item.mismatch && (
                <div className="mt-1.5 text-accent2 text-[.8rem]">
                  دسته‌ی اشتباه: {item.mismatch.from} ← {item.mismatch.to ?? "—"}
                  {item.refundedLabel ? ` · ${item.refundedLabel} به کیف پول برگشت` : " · فقط دسته اصلاح شد"}
                  {item.mismatch.note ? ` · ${item.mismatch.note}` : ""}
                </div>
              )}
              {item.delivery && (
                <div className="mt-1.5">
                  {item.delivery.isLarge ? (
                    <span className="text-dim">فایل حجیم است؛ از طریق پشتیبانی تلگرام تحویل داده می‌شود.</span>
                  ) : (
                    <>
                      <span className="text-dim">فایل تحویلی: </span>
                      {item.delivery.fileUrl ? (
                        <a href={item.delivery.fileUrl} target="_blank" rel="noreferrer noopener" dir="ltr" className="text-cyan hover:underline">
                          {item.delivery.fileName ?? item.delivery.fileUrl}
                        </a>
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                      <span className="text-dim"> — {toJalaliDateTime(item.delivery.deliveredAt)}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isRefundable(order.status) && <RefundBox orderId={order.id} priceLabel={order.priceLabel} onDone={load} />}

      <h2 className="font-display font-bold mb-3">تاریخچه‌ی رویدادها</h2>
      {order.events.length === 0 ? (
        <div className="text-dim text-[.85rem]">رویدادی ثبت نشده.</div>
      ) : (
        <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-5 sm:p-6">
          <ol className="relative border-r border-[rgb(var(--c-primary2)/.2)] pr-5 flex flex-col gap-6">
            {order.events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute right-[-25px] top-1 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-primary to-cyan" />
                <div className="flex items-center gap-2 flex-wrap text-[.85rem] font-bold mb-1">
                  {e.fromStatus && (
                    <span className="text-dim font-normal">{STATUS_LABELS[e.fromStatus as OrderStatus] ?? e.fromStatus} ←</span>
                  )}
                  <span>{STATUS_LABELS[e.toStatus as OrderStatus] ?? e.toStatus}</span>
                </div>
                <div className="text-dim text-[.78rem]">
                  {e.actor} — {toJalaliDateTime(e.createdAt)}
                </div>
                {e.note && <div className="text-[.8rem] mt-1">{e.note}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
