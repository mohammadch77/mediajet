"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toPersianDigits, rialToTomanLabel } from "@/lib/money";
import { toJalaliDate } from "@/lib/jalali";
import { ROLE_LABELS, ALL_ROLES, type Role } from "@/lib/roles";
import Pagination from "@/components/admin/Pagination";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type UserRow = {
  id: string;
  mobile: string;
  name: string | null;
  role: Role;
  createdAt: string;
  walletBalanceRial: string;
  orderCount: number;
};

type ListResponse = {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    user: "bg-[rgba(255,255,255,.06)] text-dim",
    operator: "bg-[rgba(56,225,255,.14)] text-cyan",
    admin: "bg-gradient-to-br from-primary to-primary2 text-white",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[.72rem] font-bold ${styles[role]}`}>{ROLE_LABELS[role]}</span>
  );
}

export default function AdminUsersPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ user: UserRow; role: Role } | null>(null);
  const [busy, setBusy] = useState(false);

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
      const url = `/api/admin/users?page=${page}&search=${encodeURIComponent(debouncedSearch)}`;
      const res = await fetch(url);
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

  async function confirmRoleChange() {
    if (!pendingChange) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${pendingChange.user.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: pendingChange.role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در تغییر نقش.");
      setPendingChange(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در تغییر نقش.");
      setPendingChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Users</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">مدیریت کاربران</h1>
      </div>

      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو بر اساس موبایل یا نام…"
          className="w-full max-w-[360px] bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-4 py-2.5 text-[.85rem] outline-none focus:border-cyan transition"
        />
      </div>

      {error && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-5">
          {error}
        </div>
      )}

      {!data ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : data.items.length === 0 ? (
        <div className="text-dim text-[.9rem]">کاربری پیدا نشد.</div>
      ) : (
        <>
          {/* دسکتاپ: جدول */}
          <div className="hidden md:block bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl overflow-x-auto">
            <table className="w-full text-[.85rem] min-w-[760px]">
              <thead>
                <tr className="text-dim text-[.78rem] border-b border-[rgba(138,124,255,.14)]">
                  <th className="text-right font-semibold px-5 py-3.5">موبایل</th>
                  <th className="text-right font-semibold px-5 py-3.5">نام</th>
                  <th className="text-right font-semibold px-5 py-3.5">نقش</th>
                  <th className="text-right font-semibold px-5 py-3.5">تاریخ عضویت</th>
                  <th className="text-right font-semibold px-5 py-3.5">موجودی کیف پول</th>
                  <th className="text-right font-semibold px-5 py-3.5">تعداد سفارش</th>
                  <th className="text-right font-semibold px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-b border-[rgba(138,124,255,.08)] last:border-0">
                    <td dir="ltr" className="text-left px-5 py-3.5 font-semibold">
                      {u.mobile}
                    </td>
                    <td className="px-5 py-3.5">{u.name ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <RoleSelect user={u} onRequestChange={(role) => setPendingChange({ user: u, role })} />
                    </td>
                    <td className="px-5 py-3.5 text-dim">{toJalaliDate(u.createdAt)}</td>
                    <td className="px-5 py-3.5">{rialToTomanLabel(Number(u.walletBalanceRial))}</td>
                    <td className="px-5 py-3.5">{toPersianDigits(u.orderCount)}</td>
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/users/${u.id}`} className="text-cyan hover:underline text-[.8rem] font-bold">
                        جزئیات ←
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* موبایل: کارت */}
          <div className="md:hidden grid gap-3">
            {data.items.map((u) => (
              <div
                key={u.id}
                className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span dir="ltr" className="font-bold">{u.mobile}</span>
                  <RoleBadge role={u.role} />
                </div>
                <div className="text-dim text-[.8rem] mb-1">{u.name ?? "بدون نام"}</div>
                <div className="text-dim text-[.78rem] mb-3">
                  عضویت: {toJalaliDate(u.createdAt)} — {toPersianDigits(u.orderCount)} سفارش
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[.85rem]">{rialToTomanLabel(Number(u.walletBalanceRial))}</span>
                  <Link href={`/admin/users/${u.id}`} className="text-cyan text-[.8rem] font-bold">
                    جزئیات ←
                  </Link>
                </div>
                <div className="mt-3">
                  <RoleSelect user={u} onRequestChange={(role) => setPendingChange({ user: u, role })} />
                </div>
              </div>
            ))}
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!pendingChange}
        title="تغییر نقش کاربر"
        message={
          pendingChange
            ? `نقش «${pendingChange.user.mobile}» از «${ROLE_LABELS[pendingChange.user.role]}» به «${ROLE_LABELS[pendingChange.role]}» تغییر کند؟ این تغییر ثبت و قابل پیگیری خواهد بود.`
            : ""
        }
        confirmLabel="تغییر نقش"
        busy={busy}
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingChange(null)}
      />
    </div>
  );
}

function RoleSelect({ user, onRequestChange }: { user: UserRow; onRequestChange: (role: Role) => void }) {
  return (
    <select
      value={user.role}
      onChange={(e) => onRequestChange(e.target.value as Role)}
      className="bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-3 py-1.5 text-[.78rem] outline-none focus:border-cyan transition cursor-pointer"
    >
      {ALL_ROLES.map((r) => (
        <option key={r} value={r} className="bg-bg2">
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}
