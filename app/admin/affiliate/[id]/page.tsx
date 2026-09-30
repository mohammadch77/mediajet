"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/money";

type Detail = {
  affiliate: {
    id: string;
    mobile: string;
    name: string | null;
    code: string;
    joinedAt: string;
    suspendedAt: string | null;
    suspendReason: string | null;
    balanceLabel: string;
    referralsCount: number;
  };
  referrals: { id: string; mobile: string; name: string | null; joinedAt: string; ordersCount: number }[];
  ledger: {
    id: string;
    type: string;
    amountLabel: string;
    balanceAfterLabel: string;
    orderId: string | null;
    orderNumber: string | null;
    percent: number | null;
    note: string | null;
    createdAt: string;
  }[];
  payouts: { id: string; amountLabel: string; status: string; bankRef: string | null; adminNote: string | null; createdAt: string }[];
  logs: { id: string; action: string; detail: string; actorMobile: string; createdAt: string }[];
};

const ENTRY: Record<string, { label: string; sign: "+" | "−"; cls: string }> = {
  commission: { label: "کمیسیون", sign: "+", cls: "text-[#3ddc84]" },
  commission_reversal: { label: "برگشت کمیسیون", sign: "−", cls: "text-accent2" },
  payout_hold: { label: "درخواست تسویه", sign: "−", cls: "text-dim" },
  payout_release: { label: "بازگشت تسویه‌ی ردشده", sign: "+", cls: "text-cyan" },
  adjustment_credit: { label: "اصلاح دستی", sign: "+", cls: "text-primary2" },
  adjustment_debit: { label: "اصلاح دستی", sign: "−", cls: "text-primary2" },
};

const ACTION_LABEL: Record<string, string> = {
  suspend: "تعلیق",
  unsuspend: "رفع تعلیق",
  set_referrer: "تغییر معرف",
  adjust_balance: "اصلاح موجودی",
};

const PAYOUT_LABEL: Record<string, string> = { requested: "در انتظار", paid: "واریز شد", rejected: "رد شد" };

const card = "bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl";
const inputCls =
  "w-full min-w-0 font-body text-[.88rem] text-text bg-bg border border-[rgba(138,124,255,.14)] rounded-xl p-[10px_12px] focus:border-primary outline-none";

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AdminAffiliateDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/affiliate/affiliates/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت اطلاعات همکار.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات همکار.");
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="text-accent2">{error}</div>;
  if (!data) return <div className="text-dim">در حال بارگذاری...</div>;
  const a = data.affiliate;

  return (
    <div className="grid gap-6">
      <Link href="/admin/affiliate" className="text-dim text-[.85rem] hover:text-text transition">
        ← بازگشت به همکاری در فروش
      </Link>

      <div className={`${card} p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            <Link href={`/admin/users/${a.id}`} dir="ltr" className="font-display text-xl font-extrabold text-cyan hover:underline">
              {a.mobile}
            </Link>
            <div className="text-dim text-[.85rem] mt-1">{a.name ?? "بدون نام"}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="latin font-bold px-3 py-1.5 rounded-full bg-[rgba(255,255,255,.05)] border border-[rgba(138,124,255,.2)]">{a.code}</span>
            <span
              className={
                "px-3 py-1.5 rounded-full text-[.78rem] font-bold " +
                (a.suspendedAt ? "bg-[rgba(255,107,53,.14)] text-accent2" : "bg-[rgba(61,220,132,.14)] text-[#3ddc84]")
              }
            >
              {a.suspendedAt ? "معلق" : "فعال"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[.85rem]">
          <div><span className="text-dim">موجودی: </span><b>{a.balanceLabel}</b></div>
          <div><span className="text-dim">زیرمجموعه: </span><b>{toPersianDigits(a.referralsCount)} نفر</b></div>
          <div className="col-span-2 sm:col-span-1"><span className="text-dim">عضویت: </span>{toJalaliDateTime(a.joinedAt)}</div>
        </div>
        {a.suspendedAt && (
          <div className="mt-3 text-[.82rem] text-accent2">
            معلق از {toJalaliDateTime(a.suspendedAt)} — {a.suspendReason}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SuspendBox id={a.id} suspended={!!a.suspendedAt} onDone={load} />
        <AdjustBox id={a.id} onDone={load} />
      </div>

      <Section title="دفتر کمیسیون (۱۰۰ ردیف اخیر)">
        {data.ledger.length === 0 ? (
          <Empty>ردیفی ثبت نشده.</Empty>
        ) : (
          <div className="grid gap-2">
            {data.ledger.map((l) => {
              const e = ENTRY[l.type] ?? { label: l.type, sign: "+", cls: "" };
              return (
                <div key={l.id} className={`${card} p-3 flex items-center justify-between gap-3 flex-wrap text-[.84rem]`}>
                  <div className="min-w-0">
                    <b>{e.label}</b>
                    {l.orderNumber && (
                      <>
                        {" · "}
                        <Link href={`/admin/orders/${l.orderId}`} className="text-cyan hover:underline latin">{l.orderNumber}</Link>
                      </>
                    )}
                    {l.percent !== null && <span className="text-dim"> · {toPersianDigits(l.percent)}٪</span>}
                    <div className="text-dim text-[.75rem] mt-0.5">
                      {l.note} · {toJalaliDateTime(l.createdAt)}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className={`font-bold ${e.cls}`}>{e.sign} {l.amountLabel}</div>
                    <div className="text-dim text-[.72rem]">مانده: {l.balanceAfterLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`زیرمجموعه‌ها (${toPersianDigits(a.referralsCount)})`}>
          {data.referrals.length === 0 ? (
            <Empty>هنوز زیرمجموعه‌ای ندارد.</Empty>
          ) : (
            <div className="grid gap-2">
              {data.referrals.map((r) => (
                <Link key={r.id} href={`/admin/users/${r.id}`} className={`${card} p-3 flex items-center justify-between gap-2 text-[.84rem] hover:border-[rgba(56,225,255,.4)]`}>
                  <span>
                    <span dir="ltr" className="text-cyan">{r.mobile}</span>
                    {r.name && <span className="text-dim"> · {r.name}</span>}
                  </span>
                  <span className="text-dim text-[.75rem]">{toPersianDigits(r.ordersCount)} سفارش · {toJalaliDateTime(r.joinedAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <div className="grid gap-6 content-start">
          <Section title="تسویه‌ها">
            {data.payouts.length === 0 ? (
              <Empty>درخواست تسویه‌ای نداشته.</Empty>
            ) : (
              <div className="grid gap-2">
                {data.payouts.map((p) => (
                  <div key={p.id} className={`${card} p-3 text-[.84rem]`}>
                    <div className="flex justify-between gap-2">
                      <b>{p.amountLabel}</b>
                      <span className="text-dim">{PAYOUT_LABEL[p.status] ?? p.status}</span>
                    </div>
                    <div className="text-dim text-[.75rem] mt-0.5">
                      {toJalaliDateTime(p.createdAt)}
                      {p.bankRef && <> · پیگیری <span className="latin">{p.bankRef}</span></>}
                      {p.adminNote && <> · {p.adminNote}</>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="لاگ اقدامات ادمین">
            {data.logs.length === 0 ? (
              <Empty>اقدامی ثبت نشده.</Empty>
            ) : (
              <div className="grid gap-2">
                {data.logs.map((l) => (
                  <div key={l.id} className={`${card} p-3 text-[.84rem]`}>
                    <b>{ACTION_LABEL[l.action] ?? l.action}</b>
                    <span className="text-dim"> · {l.detail}</span>
                    <div className="text-dim text-[.72rem] mt-0.5">
                      <span dir="ltr">{l.actorMobile}</span> · {toJalaliDateTime(l.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-dim text-[.85rem]">{children}</div>;
}

async function postAction(id: string, body: unknown): Promise<void> {
  const res = await fetch(`/api/admin/affiliate/affiliates/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "عملیات ناموفق بود.");
}

function SuspendBox({ id, suspended, onDone }: { id: string; suspended: boolean; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await postAction(id, { action: suspended ? "unsuspend" : "suspend", reason });
      setReason("");
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${card} p-5`}>
      <h3 className="font-bold mb-1">{suspended ? "رفع تعلیق" : "تعلیق همکار"}</h3>
      <p className="text-dim text-[.8rem] mb-3 leading-[1.9]">
        {suspended
          ? "با رفع تعلیق، لینک همکار دوباره زیرمجموعه ثبت می‌کند و از خریدهای بعدی کمیسیون می‌گیرد."
          : "همکار معلق: لینکش زیرمجموعه‌ی جدید ثبت نمی‌کند، کمیسیون جدید نمی‌گیرد و نمی‌تواند تسویه بدهد. زیرمجموعه‌ها و موجودی‌اش حفظ می‌شوند."}
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل (الزامی؛ به همکار نمایش داده می‌شود)" className={inputCls} />
        <button
          onClick={submit}
          disabled={busy}
          className={
            "font-bold rounded-xl px-4 py-2.5 text-[.85rem] shrink-0 disabled:opacity-60 " +
            (suspended
              ? "bg-[rgba(61,220,132,.16)] text-[#3ddc84] border border-[rgba(61,220,132,.35)]"
              : "bg-[rgba(255,107,53,.12)] text-accent2 border border-[rgba(255,107,53,.3)]")
          }
        >
          {suspended ? "رفع تعلیق" : "تعلیق"}
        </button>
      </div>
      {err && <div className="text-accent2 text-[.8rem] mt-2">{err}</div>}
    </div>
  );
}

function AdjustBox({ id, onDone }: { id: string; onDone: () => Promise<void> }) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [toman, setToman] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [key, setKey] = useState(newKey);

  async function submit() {
    const digits = toman.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[,\s٬]/g, "");
    if (!/^[1-9]\d{0,14}$/.test(digits)) {
      setErr("مبلغ را به تومان و به‌صورت عدد صحیح وارد کن.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      // تومان → ریال با رشته، بدون float.
      await postAction(id, { action: "adjust", direction, amountRial: `${digits}0`, reason, idempotencyKey: key });
      setToman("");
      setReason("");
      setKey(newKey());
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${card} p-5`}>
      <h3 className="font-bold mb-1">اصلاح دستی موجودی</h3>
      <p className="text-dim text-[.8rem] mb-3">برای جبران خطا یا جایزه. در دفتر و لاگ ادمین ثبت و به همکار اعلان می‌شود.</p>
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2 mb-2">
        <select value={direction} onChange={(e) => setDirection(e.target.value as "credit" | "debit")} className={inputCls}>
          <option value="credit">افزایش</option>
          <option value="debit">کاهش</option>
        </select>
        <input value={toman} onChange={(e) => setToman(e.target.value)} inputMode="numeric" placeholder="مبلغ به تومان" className={inputCls} />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="دلیل (الزامی)" className={inputCls} />
        <button onClick={submit} disabled={busy} className="font-bold rounded-xl px-4 py-2.5 text-[.85rem] shrink-0 bg-gradient-to-br from-primary to-primary2 text-white disabled:opacity-60">
          ثبت اصلاح
        </button>
      </div>
      {err && <div className="text-accent2 text-[.8rem] mt-2">{err}</div>}
    </div>
  );
}
