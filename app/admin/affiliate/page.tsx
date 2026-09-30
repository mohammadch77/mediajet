"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import Pagination from "@/components/admin/Pagination";

type PayoutStatus = "requested" | "paid" | "rejected";

type PayoutRow = {
  id: string;
  amountLabel: string;
  cardNumber: string;
  cardHolder: string;
  status: PayoutStatus;
  bankRef: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByMobile: string | null;
  user: { id: string; mobile: string; name: string | null; balanceLabel: string };
};

type ListResponse = { items: PayoutRow[]; total: number; page: number; pageSize: number; totalPages: number };

const STATUS: Record<PayoutStatus, { label: string; cls: string }> = {
  requested: { label: "در انتظار بررسی", cls: "bg-[rgba(255,200,60,.14)] text-[#ffc83c]" },
  paid: { label: "واریز شد", cls: "bg-[rgba(61,220,132,.14)] text-[#3ddc84]" },
  rejected: { label: "رد شد", cls: "bg-[rgba(255,107,53,.14)] text-accent2" },
};

const inputCls =
  "w-full font-body text-[.88rem] text-text bg-bg border border-[rgba(138,124,255,.14)] rounded-xl p-[10px_12px] focus:border-primary outline-none";

const tabCls = (active: boolean) =>
  "px-4 py-2 rounded-xl text-[.88rem] font-bold border transition " +
  (active
    ? "bg-[rgba(56,225,255,.1)] border-[rgba(56,225,255,.4)] text-cyan"
    : "bg-transparent border-[rgba(138,124,255,.2)] text-dim hover:text-text");

export default function AdminAffiliatePage() {
  const [tab, setTab] = useState<"payouts" | "affiliates">("payouts");
  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Affiliate</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">همکاری در فروش</h1>
        <p className="text-dim text-[.85rem] mt-2">
          درصد کمیسیون و حداقل تسویه از <Link href="/admin/settings" className="text-cyan hover:underline">تنظیمات</Link> قابل تغییر است.
          بازگشت وجه سفارش (از صفحه‌ی هر سفارش) کمیسیون همان سفارش را خودکار برگشت می‌زند.
        </p>
      </div>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab("payouts")} className={tabCls(tab === "payouts")}>درخواست‌های تسویه</button>
        <button onClick={() => setTab("affiliates")} className={tabCls(tab === "affiliates")}>همکاران</button>
      </div>
      {tab === "payouts" ? <PayoutsTab /> : <AffiliatesTab />}
    </div>
  );
}

type AffiliateRow = {
  id: string;
  mobile: string;
  name: string | null;
  code: string;
  joinedAt: string;
  referralsCount: number;
  balanceLabel: string;
  netEarnedLabel: string;
  paidLabel: string;
  suspended: boolean;
};

function AffiliatesTab() {
  const [data, setData] = useState<{ items: AffiliateRow[]; total: number; page: number; totalPages: number } | null>(null);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const res = await fetch(`/api/admin/affiliate/affiliates?page=${page}${query ? `&q=${encodeURIComponent(query)}` : ""}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "خطا در دریافت همکاران.");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطا در دریافت همکاران.");
      }
    })();
  }, [page, query]);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
        className="flex gap-2 mb-5"
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجو: موبایل، نام یا کد" className={inputCls} />
        <button className="font-bold rounded-xl px-4 text-[.88rem] bg-gradient-to-br from-primary to-primary2 text-white shrink-0">جست‌وجو</button>
      </form>

      {error && <div className="text-accent2 mb-4">{error}</div>}
      {!data ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : data.items.length === 0 ? (
        <div className="text-dim text-[.9rem]">همکاری پیدا نشد.</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {data.items.map((a) => (
              <div key={a.id} className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                  <div className="min-w-0">
                    <Link href={`/admin/users/${a.id}`} className="text-cyan font-bold hover:underline" dir="ltr">{a.mobile}</Link>
                    {a.name && <span className="text-dim text-[.82rem]"> · {a.name}</span>}
                  </div>
                  <span className="flex items-center gap-1.5">
                    {a.suspended && <span className="text-[.72rem] font-bold px-2 py-1 rounded-full bg-[rgba(255,107,53,.14)] text-accent2">معلق</span>}
                    <span className="latin text-[.78rem] font-bold px-2.5 py-1 rounded-full bg-[rgba(255,255,255,.05)] border border-[rgba(138,124,255,.2)]">{a.code}</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[.82rem]">
                  <div><span className="text-dim">زیرمجموعه: </span>{a.referralsCount.toLocaleString("fa-IR")} نفر</div>
                  <div><span className="text-dim">موجودی: </span><span className="font-semibold">{a.balanceLabel}</span></div>
                  <div><span className="text-dim">کمیسیون خالص: </span>{a.netEarnedLabel}</div>
                  <div><span className="text-dim">واریزشده: </span>{a.paidLabel}</div>
                  <div className="col-span-2 flex items-center justify-between gap-2 text-[.75rem] mt-1">
                    <span className="text-dim">عضویت: {toJalaliDateTime(a.joinedAt)}</span>
                    <Link href={`/admin/affiliate/${a.id}`} className="text-cyan font-bold hover:underline">مدیریت ←</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function PayoutsTab() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [status, setStatus] = useState<"" | PayoutStatus>("requested");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/affiliate/payouts?page=${page}${status ? `&status=${status}` : ""}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت درخواست‌ها.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت درخواست‌ها.");
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center gap-2.5 flex-wrap mb-5">
        {(["requested", "paid", "rejected", ""] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={
              "px-3.5 py-1.5 rounded-full text-[.82rem] font-bold border transition " +
              (status === s
                ? "bg-gradient-to-br from-primary to-primary2 text-white border-transparent"
                : "bg-[rgba(255,255,255,.04)] border-[rgba(138,124,255,.2)] text-dim hover:text-text")
            }
          >
            {s === "" ? "همه" : STATUS[s].label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-5">
          {error}
        </div>
      )}

      {!data ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : data.items.length === 0 ? (
        <div className="text-dim text-[.9rem]">درخواستی پیدا نشد.</div>
      ) : (
        <>
          <div className="grid gap-3">
            {data.items.map((p) => (
              <PayoutCard key={p.id} payout={p} onReviewed={load} />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function PayoutCard({ payout: p, onReviewed }: { payout: PayoutRow; onReviewed: () => Promise<void> }) {
  const [bankRef, setBankRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function review(action: "paid" | "rejected") {
    if (action === "rejected" && !confirm("این درخواست رد شود و مبلغ به موجودی همکار برگردد؟")) return;
    setBusy(true);
    setErr(null);
    try {
      const body = action === "paid" ? { action, bankRef, ...(note && { note }) } : { action, note };
      const res = await fetch(`/api/admin/affiliate/payouts/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ثبت نتیجه ناموفق بود.");
      await onReviewed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ثبت نتیجه ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0">
          <div className="font-display text-[1.2rem] font-extrabold">{p.amountLabel}</div>
          <Link href={`/admin/affiliate/${p.user.id}`} className="text-cyan text-[.85rem] hover:underline" dir="ltr">
            {p.user.mobile}
          </Link>
          {p.user.name && <span className="text-dim text-[.82rem]"> · {p.user.name}</span>}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[.72rem] font-bold ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[.85rem] mb-3">
        <div>
          <span className="text-dim">شماره کارت: </span>
          <span className="latin font-semibold break-all" dir="ltr">{p.cardNumber.replace(/(\d{4})(?=\d)/g, "$1-")}</span>
        </div>
        <div>
          <span className="text-dim">صاحب کارت: </span>
          <span className="font-semibold">{p.cardHolder}</span>
        </div>
        <div>
          <span className="text-dim">تاریخ درخواست: </span>
          {toJalaliDateTime(p.createdAt)}
        </div>
        <div>
          <span className="text-dim">موجودی فعلی همکار: </span>
          {p.user.balanceLabel}
        </div>
        {p.reviewedAt && (
          <div className="sm:col-span-2 text-dim">
            بررسی: {toJalaliDateTime(p.reviewedAt)} {p.reviewedByMobile && <span dir="ltr">({p.reviewedByMobile})</span>}
            {p.bankRef && <> · پیگیری: <span className="latin">{p.bankRef}</span></>}
            {p.adminNote && <> · {p.adminNote}</>}
          </div>
        )}
      </div>

      {p.status === "requested" && (
        <div className="border-t border-[rgba(138,124,255,.1)] pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
            <input value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="شماره پیگیری واریز" className={inputCls} />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="توضیح (برای رد الزامی است)" className={inputCls} />
          </div>
          {err && <div className="text-accent2 text-[.82rem] mb-2">{err}</div>}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => review("paid")}
              disabled={busy}
              className="font-bold rounded-xl px-4 py-2.5 text-[.88rem] bg-[rgba(61,220,132,.16)] text-[#3ddc84] border border-[rgba(61,220,132,.35)] hover:bg-[rgba(61,220,132,.25)] disabled:opacity-60 flex-1 sm:flex-none"
            >
              واریز شد
            </button>
            <button
              onClick={() => review("rejected")}
              disabled={busy}
              className="font-bold rounded-xl px-4 py-2.5 text-[.88rem] bg-[rgba(255,107,53,.12)] text-accent2 border border-[rgba(255,107,53,.3)] hover:bg-[rgba(255,107,53,.2)] disabled:opacity-60 flex-1 sm:flex-none"
            >
              رد درخواست
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
