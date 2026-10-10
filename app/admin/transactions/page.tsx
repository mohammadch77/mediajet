"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import Pagination from "@/components/admin/Pagination";

type TxRow = {
  id: string;
  type: "credit" | "debit";
  amountLabel: string;
  balanceAfterLabel: string;
  ref: string | null;
  note: string | null;
  createdAt: string;
  user: { id: string; mobile: string; name: string | null };
};

type ListResponse = { items: TxRow[]; total: number; page: number; pageSize: number; totalPages: number };

export default function AdminTransactionsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [typeFilter, setTypeFilter] = useState<"" | "credit" | "debit">("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const url = `/api/admin/transactions?page=${page}${typeFilter ? `&type=${typeFilter}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت تراکنش‌ها.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت تراکنش‌ها.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, typeFilter]);

  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Transactions</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">تراکنش‌های کیف پول</h1>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap mb-5">
        {(["", "credit", "debit"] as const).map((t) => (
          <button
            key={t || "all"}
            onClick={() => {
              setTypeFilter(t);
              setPage(1);
            }}
            className={
              "px-3.5 py-1.5 rounded-full text-[.82rem] font-bold border transition " +
              (typeFilter === t
                ? "bg-gradient-to-br from-primary to-primary-deep text-white border-transparent"
                : "bg-[rgb(var(--c-ov)/.04)] border-[rgb(var(--c-primary2)/.2)] text-dim hover:text-text")
            }
          >
            {t === "" ? "همه" : t === "credit" ? "شارژ" : "برداشت"}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 mb-5">
          {error}
        </div>
      )}

      {!data ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : data.items.length === 0 ? (
        <div className="text-dim text-[.9rem]">تراکنشی پیدا نشد.</div>
      ) : (
        <>
          <div className="hidden md:block bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl overflow-x-auto">
            <table className="w-full text-[.85rem] min-w-[760px]">
              <thead>
                <tr className="text-dim text-[.78rem] border-b border-[rgb(var(--c-primary2)/.14)]">
                  <th className="text-right font-semibold px-5 py-3.5">کاربر</th>
                  <th className="text-right font-semibold px-5 py-3.5">نوع</th>
                  <th className="text-right font-semibold px-5 py-3.5">مبلغ</th>
                  <th className="text-right font-semibold px-5 py-3.5">موجودی پس از تراکنش</th>
                  <th className="text-right font-semibold px-5 py-3.5">یادداشت</th>
                  <th className="text-right font-semibold px-5 py-3.5">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <tr key={t.id} className="border-b border-[rgb(var(--c-primary2)/.08)] last:border-0">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/users/${t.user.id}`} className="text-cyan hover:underline" dir="ltr">
                        {t.user.mobile}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={
                          "px-2.5 py-1 rounded-full text-[.72rem] font-bold " +
                          (t.type === "credit" ? "bg-[rgb(var(--c-cyan)/.14)] text-cyan" : "bg-[rgb(var(--c-accent)/.14)] text-accent2")
                        }
                      >
                        {t.type === "credit" ? "شارژ" : "برداشت"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold">{t.amountLabel}</td>
                    <td className="px-5 py-3.5 text-dim">{t.balanceAfterLabel}</td>
                    <td className="px-5 py-3.5 text-dim">{t.note ?? "—"}</td>
                    <td className="px-5 py-3.5 text-dim">{toJalaliDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden grid gap-3">
            {data.items.map((t) => (
              <div
                key={t.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/admin/users/${t.user.id}`} className="text-cyan font-bold" dir="ltr">
                    {t.user.mobile}
                  </Link>
                  <span
                    className={
                      "px-2.5 py-1 rounded-full text-[.72rem] font-bold " +
                      (t.type === "credit" ? "bg-[rgb(var(--c-cyan)/.14)] text-cyan" : "bg-[rgb(var(--c-accent)/.14)] text-accent2")
                    }
                  >
                    {t.type === "credit" ? "شارژ" : "برداشت"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[.85rem] mb-1">
                  <span className="font-semibold">{t.amountLabel}</span>
                  <span className="text-dim text-[.78rem]">موجودی: {t.balanceAfterLabel}</span>
                </div>
                {t.note && <div className="text-dim text-[.78rem] mb-1">{t.note}</div>}
                <div className="text-dim text-[.72rem]">{toJalaliDateTime(t.createdAt)}</div>
              </div>
            ))}
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
