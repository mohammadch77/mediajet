"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orderState";
import Pagination from "@/components/admin/Pagination";

type OrderRow = {
  id: string;
  orderNumber: string;
  category: string;
  sourceSite: string;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
  user: { id: string; mobile: string; name: string | null };
};

type ListResponse = { items: OrderRow[]; total: number; page: number; pageSize: number; totalPages: number };

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

export default function AdminOrdersPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function load() {
    setError(null);
    try {
      const url = `/api/admin/orders?page=${page}&search=${encodeURIComponent(debouncedSearch)}${
        statusFilter ? `&status=${statusFilter}` : ""
      }`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت سفارش‌ها.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت سفارش‌ها.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, statusFilter]);

  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Orders</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">مدیریت سفارش‌ها</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو بر اساس شماره سفارش، موبایل، نام، سایت یا دسته…"
          className="flex-1 min-w-[220px] max-w-[360px] bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-4 py-2.5 text-[.85rem] outline-none focus:border-cyan transition"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as OrderStatus | "");
            setPage(1);
          }}
          className="bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-4 py-2.5 text-[.85rem] outline-none focus:border-cyan transition cursor-pointer"
        >
          <option value="" className="bg-bg2">همه‌ی وضعیت‌ها</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-bg2">
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-5">
          {error}
        </div>
      )}

      {!data ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : data.items.length === 0 ? (
        <div className="text-dim text-[.9rem]">سفارشی پیدا نشد.</div>
      ) : (
        <>
          <div className="hidden md:block bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl overflow-x-auto">
            <table className="w-full text-[.85rem] min-w-[820px]">
              <thead>
                <tr className="text-dim text-[.78rem] border-b border-[rgba(138,124,255,.14)]">
                  <th className="text-right font-semibold px-5 py-3.5">شماره</th>
                  <th className="text-right font-semibold px-5 py-3.5">کاربر</th>
                  <th className="text-right font-semibold px-5 py-3.5">دسته</th>
                  <th className="text-right font-semibold px-5 py-3.5">سایت</th>
                  <th className="text-right font-semibold px-5 py-3.5">مبلغ</th>
                  <th className="text-right font-semibold px-5 py-3.5">وضعیت</th>
                  <th className="text-right font-semibold px-5 py-3.5">تاریخ</th>
                  <th className="text-right font-semibold px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id} className="border-b border-[rgba(138,124,255,.08)] last:border-0">
                    <td dir="ltr" className="px-5 py-3.5 text-right font-bold latin whitespace-nowrap">{o.orderNumber}</td>
                    <td className="px-5 py-3.5">
                      <div dir="ltr" className="text-left font-semibold">{o.user.mobile}</div>
                      <div className="text-dim text-[.75rem]">{o.user.name ?? "بدون نام"}</div>
                    </td>
                    <td className="px-5 py-3.5">{o.category}</td>
                    <td className="px-5 py-3.5">{o.sourceSite}</td>
                    <td className="px-5 py-3.5">{o.priceLabel}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[.72rem] font-bold bg-[rgba(255,255,255,.06)]">
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-dim">{toJalaliDateTime(o.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/orders/${o.id}`} className="text-cyan hover:underline text-[.8rem] font-bold">
                        جزئیات ←
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden grid gap-3">
            {data.items.map((o) => (
              <div
                key={o.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display font-bold">
                    {o.category} <span dir="ltr" className="latin text-dim text-[.78rem]">{o.orderNumber}</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[.72rem] font-bold bg-[rgba(255,255,255,.06)]">
                    {STATUS_LABELS[o.status]}
                  </span>
                </div>
                <div className="text-dim text-[.78rem] mb-1">{o.sourceSite}</div>
                <div dir="ltr" className="text-dim text-[.78rem] mb-3">{o.user.mobile}</div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[.85rem]">{o.priceLabel}</span>
                  <Link href={`/admin/orders/${o.id}`} className="text-cyan text-[.8rem] font-bold">
                    جزئیات ←
                  </Link>
                </div>
                <div className="text-dim text-[.72rem] mt-2">{toJalaliDateTime(o.createdAt)}</div>
              </div>
            ))}
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
