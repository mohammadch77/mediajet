"use client";
import { useEffect, useState } from "react";
import { toPersianDigits, rialToTomanLabel } from "@/lib/money";
import Pagination from "@/components/admin/Pagination";
import WalletAdjustPanel from "@/components/admin/WalletAdjustPanel";

type UserRow = {
  id: string;
  mobile: string;
  name: string | null;
  walletBalanceRial: string;
  orderCount: number;
};

type ListResponse = { items: UserRow[]; total: number; page: number; pageSize: number; totalPages: number };

export default function AdminWalletsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

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
      const res = await fetch(`/api/admin/users?page=${page}&search=${encodeURIComponent(debouncedSearch)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت کاربران.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت کاربران.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const manageButton = (id: string) => (
    <button
      onClick={() => setOpenUserId(id)}
      className="px-4 py-1.5 rounded-full text-[.8rem] font-bold text-white bg-gradient-to-br from-primary to-primary2 transition hover:-translate-y-px"
    >
      مدیریت
    </button>
  );

  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Wallets</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">مدیریت کیف پول کاربران</h1>
        <p className="text-dim text-[.85rem] mt-2">
          کاربر را پیدا کن و موجودی‌اش را با ثبت دلیل دستی کم یا زیاد کن. همه‌ی تعدیل‌ها در تاریخچه‌ی کیف پول می‌مانند.
        </p>
      </div>

      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو بر اساس موبایل یا نام…"
          className="w-full max-w-[360px] bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-4 py-2.5 text-[.85rem] outline-none focus:border-cyan transition"
        />
      </div>

      {error && (
        <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 mb-5">
          {error}
        </div>
      )}

      {!data ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : data.items.length === 0 ? (
        <div className="text-dim text-[.9rem]">کاربری پیدا نشد.</div>
      ) : (
        <>
          <div className="hidden md:block bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl overflow-x-auto">
            <table className="w-full text-[.85rem] min-w-[640px]">
              <thead>
                <tr className="text-dim text-[.78rem] border-b border-[rgb(var(--c-primary2)/.14)]">
                  <th className="text-right font-semibold px-5 py-3.5">موبایل</th>
                  <th className="text-right font-semibold px-5 py-3.5">نام</th>
                  <th className="text-right font-semibold px-5 py-3.5">موجودی</th>
                  <th className="text-right font-semibold px-5 py-3.5">سفارش‌ها</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-b border-[rgb(var(--c-primary2)/.08)] last:border-0">
                    <td dir="ltr" className="text-left px-5 py-3.5 font-semibold">{u.mobile}</td>
                    <td className="px-5 py-3.5">{u.name ?? "—"}</td>
                    <td className="px-5 py-3.5 font-semibold">{rialToTomanLabel(Number(u.walletBalanceRial))}</td>
                    <td className="px-5 py-3.5 text-dim">{toPersianDigits(u.orderCount)}</td>
                    <td className="px-5 py-3.5 text-left">{manageButton(u.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden grid gap-3">
            {data.items.map((u) => (
              <div
                key={u.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span dir="ltr" className="font-bold">{u.mobile}</span>
                  {manageButton(u.id)}
                </div>
                <div className="text-dim text-[.8rem] mb-2">{u.name ?? "بدون نام"}</div>
                <div className="font-semibold text-[.9rem]">{rialToTomanLabel(Number(u.walletBalanceRial))}</div>
              </div>
            ))}
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}

      {openUserId && (
        <WalletAdjustPanel userId={openUserId} onClose={() => setOpenUserId(null)} onChanged={load} />
      )}
    </div>
  );
}
