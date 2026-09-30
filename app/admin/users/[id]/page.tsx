"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { rialToTomanLabel, toPersianDigits } from "@/lib/money";
import { toJalaliDateTime } from "@/lib/jalali";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orderState";
import Pagination from "@/components/admin/Pagination";

type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages: number };

type OrderRow = {
  id: string;
  category: string;
  sourceSite: string;
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
};

type TxRow = {
  id: string;
  type: "credit" | "debit";
  amountLabel: string;
  balanceAfterLabel: string;
  ref: string | null;
  note: string | null;
  createdAt: string;
};

type DetailResponse = {
  user: {
    id: string;
    mobile: string;
    name: string | null;
    role: Role;
    createdAt: string;
    walletBalanceRial: string;
    referrer: { id: string; mobile: string; referralCode: string | null } | null;
    isAffiliate: boolean;
  };
  orders: Paginated<OrderRow>;
  transactions: Paginated<TxRow>;
};

/** معرفِ کاربر (همکاری در فروش) و فرم تغییر/حذف آن؛ هر تغییر با دلیل در لاگ ادمین ثبت می‌شود. */
function ReferrerBox({
  userId,
  referrer,
  isAffiliate,
  onChange,
}: {
  userId: string;
  referrer: DetailResponse["user"]["referrer"];
  isAffiliate: boolean;
  onChange: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(remove: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/referrer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: remove ? null : code, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "تغییر معرف ناموفق بود.");
      setEditing(false);
      setCode("");
      setReason("");
      await onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "تغییر معرف ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full min-w-0 font-body text-[.88rem] text-text bg-bg border border-[rgba(138,124,255,.14)] rounded-xl p-[10px_12px] focus:border-primary outline-none";

  return (
    <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[.88rem]">
          <span className="text-dim">معرف (همکاری در فروش): </span>
          {referrer ? (
            <Link href={`/admin/affiliate/${referrer.id}`} className="text-cyan hover:underline">
              <span dir="ltr">{referrer.mobile}</span> · <span className="latin">{referrer.referralCode}</span>
            </Link>
          ) : (
            <span className="text-dim">ندارد</span>
          )}
          {isAffiliate && (
            <Link href={`/admin/affiliate/${userId}`} className="mr-3 text-[.8rem] text-primary2 hover:underline">
              این کاربر خودش همکار است ←
            </Link>
          )}
        </div>
        <button onClick={() => setEditing((v) => !v)} className="text-[.82rem] font-bold text-cyan hover:underline">
          {editing ? "انصراف" : "تغییر معرف"}
        </button>
      </div>
      {editing && (
        <div className="mt-3 grid gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد همکاری معرف جدید" dir="ltr" className={`${input} latin text-left`} />
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل تغییر (الزامی)" className={input} />
          </div>
          <p className="text-dim text-[.78rem]">فقط روی کمیسیون خریدهای بعدی اثر دارد؛ کمیسیون‌های قبلی تغییر نمی‌کنند.</p>
          {err && <div className="text-accent2 text-[.82rem]">{err}</div>}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => save(false)} disabled={busy} className="font-bold rounded-xl px-4 py-2 text-[.85rem] bg-gradient-to-br from-primary to-primary2 text-white disabled:opacity-60">
              ثبت معرف جدید
            </button>
            {referrer && (
              <button onClick={() => save(true)} disabled={busy} className="font-bold rounded-xl px-4 py-2 text-[.85rem] bg-[rgba(255,107,53,.12)] text-accent2 border border-[rgba(255,107,53,.3)] disabled:opacity-60">
                حذف معرف
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [txPage, setTxPage] = useState(1);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${params.id}?ordersPage=${ordersPage}&txPage=${txPage}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت اطلاعات کاربر.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات کاربر.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, ordersPage, txPage]);

  if (error) {
    return (
      <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="text-dim">در حال بارگذاری...</div>;
  }

  const { user, orders, transactions } = data;

  return (
    <div>
      <Link href="/admin/users" className="text-dim text-[.85rem] hover:text-text transition mb-4 inline-block">
        ← بازگشت به لیست کاربران
      </Link>

      <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-5 sm:p-6 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div>
          <div dir="ltr" className="font-display text-xl font-extrabold text-left">{user.mobile}</div>
          <div className="text-dim text-[.85rem] mt-1">{user.name ?? "بدون نام"}</div>
        </div>
        <div className="text-[.8rem]">
          <span className="text-dim">نقش: </span>
          <span className="font-bold">{ROLE_LABELS[user.role]}</span>
        </div>
        <div className="text-[.8rem]">
          <span className="text-dim">عضویت: </span>
          <span className="font-bold">{toJalaliDateTime(user.createdAt)}</span>
        </div>
        <div className="text-[.8rem]">
          <span className="text-dim">موجودی کیف پول: </span>
          <span className="font-bold">{rialToTomanLabel(Number(user.walletBalanceRial))}</span>
        </div>
      </div>

      <ReferrerBox userId={user.id} referrer={user.referrer} isAffiliate={user.isAffiliate} onChange={load} />

      <h2 className="font-display font-bold mb-3">سفارش‌ها</h2>
      {orders.items.length === 0 ? (
        <div className="text-dim text-[.85rem] mb-8">سفارشی ثبت نشده.</div>
      ) : (
        <div className="mb-8">
          <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl overflow-x-auto">
            <table className="w-full text-[.83rem] min-w-[640px]">
              <thead>
                <tr className="text-dim text-[.76rem] border-b border-[rgba(138,124,255,.14)]">
                  <th className="text-right font-semibold px-4 py-3">دسته</th>
                  <th className="text-right font-semibold px-4 py-3">سایت</th>
                  <th className="text-right font-semibold px-4 py-3">مبلغ</th>
                  <th className="text-right font-semibold px-4 py-3">وضعیت</th>
                  <th className="text-right font-semibold px-4 py-3">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {orders.items.map((o) => (
                  <tr key={o.id} className="border-b border-[rgba(138,124,255,.08)] last:border-0">
                    <td className="px-4 py-3">{o.category}</td>
                    <td className="px-4 py-3">{o.sourceSite}</td>
                    <td className="px-4 py-3">{o.priceLabel}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-[.72rem] font-bold bg-[rgba(255,255,255,.06)]">
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dim">{toJalaliDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={orders.page} totalPages={orders.totalPages} total={orders.total} onPageChange={setOrdersPage} />
        </div>
      )}

      <h2 className="font-display font-bold mb-3">تراکنش‌های کیف پول</h2>
      {transactions.items.length === 0 ? (
        <div className="text-dim text-[.85rem]">تراکنشی ثبت نشده.</div>
      ) : (
        <div>
          <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl overflow-x-auto">
            <table className="w-full text-[.83rem] min-w-[640px]">
              <thead>
                <tr className="text-dim text-[.76rem] border-b border-[rgba(138,124,255,.14)]">
                  <th className="text-right font-semibold px-4 py-3">نوع</th>
                  <th className="text-right font-semibold px-4 py-3">مبلغ</th>
                  <th className="text-right font-semibold px-4 py-3">موجودی پس از تراکنش</th>
                  <th className="text-right font-semibold px-4 py-3">یادداشت</th>
                  <th className="text-right font-semibold px-4 py-3">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {transactions.items.map((t) => (
                  <tr key={t.id} className="border-b border-[rgba(138,124,255,.08)] last:border-0">
                    <td className="px-4 py-3">
                      <span
                        className={
                          "px-2.5 py-1 rounded-full text-[.72rem] font-bold " +
                          (t.type === "credit" ? "bg-[rgba(56,225,255,.14)] text-cyan" : "bg-[rgba(255,107,53,.14)] text-accent2")
                        }
                      >
                        {t.type === "credit" ? "شارژ" : "برداشت"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{t.amountLabel}</td>
                    <td className="px-4 py-3 text-dim">{t.balanceAfterLabel}</td>
                    <td className="px-4 py-3 text-dim">{t.note ?? "—"}</td>
                    <td className="px-4 py-3 text-dim">{toJalaliDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={transactions.page}
            totalPages={transactions.totalPages}
            total={transactions.total}
            onPageChange={setTxPage}
          />
        </div>
      )}
    </div>
  );
}
