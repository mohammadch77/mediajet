"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, isRefundable, type OrderStatus } from "@/lib/orderState";

type OrderDetail = {
  id: string;
  orderNumber: string;
  category: string | null;
  sourceSite: string | null;
  productUrl: string | null;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  user: { id: string; mobile: string; name: string | null };
  delivery: { fileUrl: string | null; fileName: string | null; isLarge: boolean; deliveredAt: string } | null;
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
    <div className="bg-[rgba(255,107,53,.06)] border border-[rgba(255,107,53,.25)] rounded-2xl p-5 mb-6">
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
          className="flex-1 min-w-0 font-body text-[.9rem] text-text bg-bg border border-[rgba(138,124,255,.14)] rounded-xl p-[10px_12px] focus:border-primary outline-none"
        />
        <button
          onClick={refund}
          disabled={busy}
          className="font-bold rounded-xl px-5 py-2.5 text-[.9rem] bg-[rgba(255,107,53,.16)] text-accent2 border border-[rgba(255,107,53,.35)] hover:bg-[rgba(255,107,53,.26)] disabled:opacity-60 shrink-0"
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
      <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4">
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

      <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-5 sm:p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h1 className="font-display text-xl font-extrabold">
            <span dir="ltr" className="latin">{order.orderNumber}</span> · {order.category}
          </h1>
          <span className="px-3 py-1.5 rounded-full text-[.8rem] font-bold bg-[rgba(255,255,255,.06)] border border-[rgba(138,124,255,.14)]">
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[.85rem]">
          <div><span className="text-dim">سایت: </span>{order.sourceSite}</div>
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
          <div className="sm:col-span-2 min-w-0">
            <span className="text-dim">لینک محصول: </span>
            <a href={order.productUrl ?? undefined} target="_blank" rel="noreferrer" dir="ltr" className="text-cyan hover:underline break-all">
              {order.productUrl}
            </a>
          </div>
        </div>

        {order.delivery && (
          <div className="mt-4 pt-4 border-t border-[rgba(138,124,255,.14)] text-[.85rem]">
            {order.delivery.isLarge ? (
              <span className="text-dim">فایل حجیم است؛ از طریق پشتیبانی تلگرام تحویل داده می‌شود.</span>
            ) : (
              <>
                <span className="text-dim">فایل تحویلی: </span>
                {order.delivery.fileUrl ? (
                  <a href={order.delivery.fileUrl} target="_blank" rel="noreferrer" dir="ltr" className="text-cyan hover:underline">
                    {order.delivery.fileName ?? order.delivery.fileUrl}
                  </a>
                ) : (
                  <span className="text-dim">—</span>
                )}
                <span className="text-dim"> — {toJalaliDateTime(order.delivery.deliveredAt)}</span>
              </>
            )}
          </div>
        )}
      </div>

      {isRefundable(order.status) && <RefundBox orderId={order.id} priceLabel={order.priceLabel} onDone={load} />}

      <h2 className="font-display font-bold mb-3">تاریخچه‌ی رویدادها</h2>
      {order.events.length === 0 ? (
        <div className="text-dim text-[.85rem]">رویدادی ثبت نشده.</div>
      ) : (
        <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-5 sm:p-6">
          <ol className="relative border-r border-[rgba(138,124,255,.2)] pr-5 flex flex-col gap-6">
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
