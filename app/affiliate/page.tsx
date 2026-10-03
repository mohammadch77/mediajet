"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { toJalaliDate, toJalaliDateTime } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/money";
import type { AffiliateDashboard, AffiliateProgramInfo } from "@/lib/affiliateSummary";

type ApiResponse = { program: AffiliateProgramInfo; loggedIn: boolean; dashboard: AffiliateDashboard | null };

const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: "در حال بررسی", cls: "bg-[rgb(var(--c-warning)/.14)] text-warning" },
  paid: { label: "واریز شد", cls: "bg-[rgb(var(--c-success)/.14)] text-success" },
  rejected: { label: "رد شد", cls: "bg-[rgb(var(--c-accent)/.14)] text-accent2" },
};

const card = "bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl";
const input =
  "w-full font-body text-[.95rem] text-text bg-bg border border-[rgb(var(--c-primary2)/.14)] rounded-xl p-[12px_14px] focus:border-primary outline-none";
const primaryBtn =
  "font-body cursor-pointer border-none font-bold rounded-[14px] transition text-[.95rem] px-5 py-3 bg-gradient-to-br from-primary to-primary2 text-white hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed";

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AffiliatePage() {
  const { user, loading, openAuthModal } = useAuth();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/affiliate", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت اطلاعات همکاری.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت اطلاعات همکاری.");
    }
  }, []);

  useEffect(() => {
    if (!loading) load();
  }, [loading, user, load]);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/affiliate/join", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ثبت‌نام در همکاری ناموفق بود.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ثبت‌نام در همکاری ناموفق بود.");
    } finally {
      setJoining(false);
    }
  }

  const percent = data ? toPersianDigits(data.program.commissionPercent) : "…";

  return (
    <div className="relative min-h-screen px-4 sm:px-[5vw] py-12 sm:py-16 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Affiliate</div>
          <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-2">همکاری در فروش</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-dim text-[.9rem] hover:text-text transition">
            ← بازگشت به صفحه‌ی اصلی
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {error && (
        <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 mb-5">
          {error}
        </div>
      )}

      {data?.dashboard ? (
        <Dashboard dashboard={data.dashboard} program={data.program} onChange={load} />
      ) : (
        <>
          <p className="text-dim leading-[2] mb-8 text-[clamp(.92rem,2.2vw,1rem)]">
            با معرفی گت‌استوک به دوستانت یا مخاطبانت، از هر خریدی که آن‌ها روی سایت انجام می‌دهند سهم می‌گیری —
            بدون نیاز به سرمایه، فروش یا پشتیبانی از مشتری.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <div className={`${card} p-5 text-center`}>
              <div className="font-display text-[clamp(2rem,6vw,2.6rem)] font-extrabold text-cyan">{percent}٪</div>
              <div className="text-dim text-[.88rem] mt-1">کمیسیون از هر سفارش پرداخت‌شده‌ی زیرمجموعه</div>
            </div>
            <div className={`${card} p-5 text-center`}>
              <div className="font-display text-[clamp(1.4rem,5vw,1.9rem)] font-extrabold text-primary2">
                {data?.program.minPayoutLabel ?? "…"}
              </div>
              <div className="text-dim text-[.88rem] mt-1">حداقل مبلغ درخواست تسویه</div>
            </div>
          </div>

          <h2 className="font-display text-[1.2rem] font-bold mb-4">این برنامه دقیقاً چطور کار می‌کند؟</h2>
          <ol className="grid gap-3 mb-8">
            {[
              ["ثبت‌نام رایگان", "وارد حسابت شو و یک‌بار در برنامه ثبت‌نام کن. هیچ هزینه یا شرطی ندارد."],
              ["دریافت لینک اختصاصی", "بلافاصله یک لینک با کد یکتای خودت ساخته می‌شود."],
              ["اشتراک‌گذاری", "لینک را در کانال، صفحه‌ی اجتماعی، وب‌سایت یا هرجای دیگری که مخاطب داری بگذار."],
              [
                "ثبت خودکار زیرمجموعه",
                "هرکس با کلیک روی لینک تو وارد سایت شود و (تا ۳۰ روز بعد) ثبت‌نام کند، برای همیشه زیرمجموعه‌ی تو می‌شود — حتی اگر ماه‌ها بعد سفارش بدهد.",
              ],
              [
                "کسب کمیسیون",
                `به‌ازای هر سفارشی که زیرمجموعه‌ات پرداخت می‌کند (از کیف پول یا درگاه)، ${percent}٪ از قیمت سفارش خودکار به حساب همکاری‌ات اضافه می‌شود. شارژ کیف پول به‌تنهایی کمیسیون ندارد؛ کمیسیون وقتی ثبت می‌شود که پول واقعاً خرج خرید شود.`,
              ],
              [
                "درخواست تسویه",
                "هروقت موجودی‌ات به حداقل لازم رسید، از همین صفحه درخواست واریز کارت‌به‌کارت بده. بعد از بررسی مالی، مبلغ برایت واریز می‌شود.",
              ],
            ].map(([title, body], i) => (
              <li key={title} className={`${card} p-4 flex gap-3.5`}>
                <span className="w-8 h-8 shrink-0 rounded-full bg-[rgb(var(--c-cyan)/.12)] text-cyan grid place-items-center font-bold">
                  {toPersianDigits(i + 1)}
                </span>
                <div className="min-w-0">
                  <div className="font-bold mb-1">{title}</div>
                  <div className="text-dim text-[.88rem] leading-[1.9]">{body}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className={`${card} p-5 sm:p-6 text-center`}>
            {loading || !data ? (
              <div className="text-dim">در حال بارگذاری...</div>
            ) : !user ? (
              <>
                <p className="text-dim mb-4">برای ساخت لینک اختصاصی‌ات، اول وارد حسابت شو (یا اگر حساب نداری، رایگان بساز).</p>
                <button onClick={openAuthModal} className={primaryBtn}>
                  ورود / ثبت‌نام رایگان
                </button>
              </>
            ) : (
              <>
                <p className="text-dim mb-4">با یک کلیک عضو شو و لینک اختصاصی‌ات را بگیر.</p>
                <button onClick={join} disabled={joining} className={primaryBtn}>
                  {joining ? "در حال ثبت‌نام..." : "عضویت رایگان در همکاری"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Dashboard({
  dashboard: d,
  program,
  onChange,
}: {
  dashboard: AffiliateDashboard;
  program: AffiliateProgramInfo;
  onChange: () => Promise<void>;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/?ref=${d.code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* مرورگر اجازه‌ی کپی نداد؛ کاربر می‌تواند دستی انتخاب کند */
    }
  }

  const canRequest = BigInt(d.balanceRial) >= BigInt(program.minPayoutRial) && !d.hasOpenPayout && !d.suspended;

  return (
    <div className="grid gap-5">
      {d.suspended && (
        <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 text-[.9rem] leading-[1.9]">
          حساب همکاری‌ات معلق است؛ تا رفع تعلیق، لینکت زیرمجموعه‌ی جدید ثبت نمی‌کند، کمیسیون جدید نمی‌گیری و امکان تسویه نداری.
          {d.suspendReason && <> دلیل: {d.suspendReason}</>} برای پیگیری از بخش «پیام‌ها» به پشتیبانی پیام بده.
        </div>
      )}
      <div className={`${card} p-5`}>
        <div className="text-dim text-[.85rem] mb-2">لینک اختصاصی تو</div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input readOnly value={link} dir="ltr" className={`${input} latin text-left`} onFocus={(e) => e.target.select()} />
          <button onClick={copy} className={`${primaryBtn} shrink-0`}>
            {copied ? "کپی شد ✓" : "کپی لینک"}
          </button>
        </div>
        <div className="text-dim text-[.8rem] mt-2">
          کد تو: <b className="latin text-text">{d.code}</b> · کمیسیون فعلی {toPersianDigits(program.commissionPercent)}٪ از هر سفارش
          پرداخت‌شده‌ی زیرمجموعه
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          ["موجودی قابل برداشت", d.balanceLabel, "text-success"],
          [`در انتظار تحویل (${toPersianDigits(d.pendingCount)})`, d.pendingLabel, "text-warning"],
          ["کل کمیسیون (خالص)", d.totalEarnedLabel, "text-cyan"],
          ["واریزشده", d.totalPaidLabel, "text-primary2"],
          ["زیرمجموعه‌ها", `${toPersianDigits(d.referralsCount)} نفر`, "text-text"],
        ].map(([label, value, cls]) => (
          <div key={label} className={`${card} p-4`}>
            <div className="text-dim text-[.78rem] mb-1.5">{label}</div>
            <div className={`font-bold text-[clamp(.95rem,2.6vw,1.15rem)] ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      <PayoutForm
        balanceRial={d.balanceRial}
        canRequest={canRequest}
        hasOpenPayout={d.hasOpenPayout}
        minPayoutLabel={program.minPayoutLabel}
        onDone={onChange}
      />

      <section>
        <h2 className="font-display text-[1.1rem] font-bold mb-3">کمیسیون‌های اخیر</h2>
        <p className="text-dim text-[.8rem] mb-3 leading-[1.9]">
          کمیسیون هر خرید اول «در انتظار» ثبت می‌شود و وقتی سفارش تحویل شد (یا مدتی آماده ماند) خودکار به موجودی قابل
          برداشت اضافه می‌شود. اگر سفارشی بازگشت وجه شود، کمیسیون همان سفارش لغو یا از موجودی کم می‌شود.
        </p>
        {d.commissions.length === 0 ? (
          <div className={`${card} p-4 text-dim text-[.9rem]`}>هنوز کمیسیونی ثبت نشده. لینکت را به اشتراک بگذار!</div>
        ) : (
          <div className="grid gap-2.5">
            {d.commissions.map((c) => (
              <div key={c.id} className={`${card} p-3.5 flex items-center justify-between gap-3 flex-wrap`}>
                <div className="min-w-0">
                  <div className="font-semibold text-[.9rem]">{c.note}</div>
                  <div className="text-dim text-[.75rem] mt-0.5">
                    {c.referral && <span dir="ltr">{c.referral}</span>} · {c.percent !== null && `${toPersianDigits(c.percent)}٪ از ${c.baseLabel}`} ·{" "}
                    {toJalaliDateTime(c.createdAt)}
                  </div>
                </div>
                <div className={`font-bold ${c.reversal ? "text-accent2" : "text-success"}`}>
                  {c.reversal ? "−" : "+"} {c.amountLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-[1.1rem] font-bold mb-3">درخواست‌های تسویه</h2>
        {d.payouts.length === 0 ? (
          <div className={`${card} p-4 text-dim text-[.9rem]`}>هنوز درخواست تسویه‌ای نداده‌ای.</div>
        ) : (
          <div className="grid gap-2.5">
            {d.payouts.map((p) => (
              <div key={p.id} className={`${card} p-3.5`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="font-bold">{p.amountLabel}</div>
                  <span className={`px-2.5 py-1 rounded-full text-[.72rem] font-bold ${PAYOUT_STATUS[p.status].cls}`}>
                    {PAYOUT_STATUS[p.status].label}
                  </span>
                </div>
                <div className="text-dim text-[.75rem] mt-1.5">
                  <span dir="ltr" className="latin">{p.card}</span> · {toJalaliDate(p.createdAt)}
                  {p.bankRef && <> · پیگیری: <span className="latin">{p.bankRef}</span></>}
                </div>
                {p.adminNote && <div className="text-dim text-[.78rem] mt-1">توضیح: {p.adminNote}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PayoutForm({
  balanceRial,
  canRequest,
  hasOpenPayout,
  minPayoutLabel,
  onDone,
}: {
  balanceRial: string;
  canRequest: boolean;
  hasOpenPayout: boolean;
  minPayoutLabel: string;
  onDone: () => Promise<void>;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // کلید یکتا برای هر «تلاش»؛ دوبار کلیک یا تکرار شبکه درخواست دوم نمی‌سازد.
  const [idemKey, setIdemKey] = useState(newIdempotencyKey);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/affiliate/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // کل موجودی درخواست می‌شود؛ سرور آن را دوباره با دفتر کمیسیون می‌سنجد.
        body: JSON.stringify({ amountRial: balanceRial, cardNumber, cardHolder, idempotencyKey: idemKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ثبت درخواست تسویه ناموفق بود.");
      setMsg({ ok: true, text: "درخواست تسویه ثبت شد و پس از بررسی مالی واریز می‌شود." });
      setIdemKey(newIdempotencyKey());
      await onDone();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "ثبت درخواست تسویه ناموفق بود." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${card} p-5`}>
      <h2 className="font-display text-[1.1rem] font-bold mb-1">درخواست تسویه (کارت‌به‌کارت)</h2>
      <p className="text-dim text-[.82rem] mb-4">
        کل موجودی قابل برداشت درخواست می‌شود. حداقل مبلغ تسویه {minPayoutLabel} است.
        {hasOpenPayout && " یک درخواست در حال بررسی داری."}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="block text-[.85rem] font-semibold mb-1.5">شماره کارت ۱۶ رقمی</span>
          <input
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            inputMode="numeric"
            dir="ltr"
            placeholder="6037-xxxx-xxxx-xxxx"
            className={`${input} latin text-left`}
            disabled={!canRequest}
          />
        </label>
        <label className="block">
          <span className="block text-[.85rem] font-semibold mb-1.5">نام صاحب کارت</span>
          <input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} className={input} disabled={!canRequest} />
        </label>
      </div>
      {msg && <div className={`text-[.85rem] mb-3 ${msg.ok ? "text-success" : "text-accent2"}`}>{msg.text}</div>}
      <button type="submit" disabled={!canRequest || submitting} className={`${primaryBtn} w-full sm:w-auto`}>
        {submitting ? "در حال ثبت..." : "درخواست واریز"}
      </button>
    </form>
  );
}
