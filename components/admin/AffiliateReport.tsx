"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toPersianDigits } from "@/lib/money";

type Report = {
  totals: {
    netCommission: string;
    netCommission30: string;
    pending: string;
    pendingCount: number;
    paidOut: string;
    paidCount: number;
    openPayouts: string;
    openPayoutsCount: number;
    withdrawable: string;
    debt: string;
    debtorsCount: number;
    affiliatesCount: number;
    suspendedCount: number;
    referralsCount: number;
    referrals30: number;
    openFlags: number;
  };
  top: {
    userId: string | null;
    mobile: string;
    name: string | null;
    code: string | null;
    referrals: number;
    netCommission: string;
    sales: string;
  }[];
};

const card = "bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl";

/** گزارش کلی همکاری در فروش (کاشی‌های آماری + جدول بهترین همکاران). */
export default function AffiliateReport({ onOpenTab }: { onOpenTab: (tab: "payouts" | "flags") => void }) {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/affiliate/report");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "خطا در دریافت گزارش.");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطا در دریافت گزارش.");
      }
    })();
  }, []);

  if (error) return <div className="text-accent2">{error}</div>;
  if (!data) return <div className="text-dim">در حال بارگذاری...</div>;
  const t = data.totals;

  const tiles: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void }[] = [
    { label: "کمیسیون خالص (کل)", value: t.netCommission, sub: `۳۰ روز اخیر: ${t.netCommission30}`, tone: "text-cyan" },
    { label: "در انتظار تحویل", value: t.pending, sub: `${toPersianDigits(t.pendingCount)} سفارش`, tone: "text-[#ffc83c]" },
    { label: "قابل برداشت همکاران", value: t.withdrawable, sub: "بدهی بالقوه‌ی سایت", tone: "text-[#3ddc84]" },
    { label: "واریزشده", value: t.paidOut, sub: `${toPersianDigits(t.paidCount)} تسویه`, tone: "text-primary2" },
    {
      label: "تسویه‌ی در انتظار بررسی",
      value: t.openPayouts,
      sub: `${toPersianDigits(t.openPayoutsCount)} درخواست`,
      tone: t.openPayoutsCount ? "text-[#ffc83c]" : "text-text",
      onClick: () => onOpenTab("payouts"),
    },
    { label: "بدهی همکاران", value: t.debt, sub: `${toPersianDigits(t.debtorsCount)} همکار بدهکار`, tone: t.debtorsCount ? "text-accent2" : "text-text" },
    {
      label: "همکاران",
      value: `${toPersianDigits(t.affiliatesCount)} نفر`,
      sub: t.suspendedCount ? `${toPersianDigits(t.suspendedCount)} معلق` : "هیچ همکار معلقی نیست",
    },
    { label: "زیرمجموعه‌ها", value: `${toPersianDigits(t.referralsCount)} نفر`, sub: `۳۰ روز اخیر: ${toPersianDigits(t.referrals30)}` },
    {
      label: "هشدار تقلب باز",
      value: toPersianDigits(t.openFlags),
      sub: t.openFlags ? "نیاز به بررسی" : "مورد مشکوکی نیست",
      tone: t.openFlags ? "text-accent2" : "text-[#3ddc84]",
      onClick: () => onOpenTab("flags"),
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map((x) => {
          const body = (
            <>
              <div className="text-dim text-[.78rem] mb-1.5">{x.label}</div>
              <div className={`font-display font-extrabold text-[clamp(1rem,2.6vw,1.35rem)] ${x.tone ?? "text-text"}`}>{x.value}</div>
              {x.sub && <div className="text-dim text-[.72rem] mt-1">{x.sub}</div>}
            </>
          );
          return x.onClick ? (
            <button key={x.label} onClick={x.onClick} className={`${card} p-4 text-right hover:border-[rgba(56,225,255,.4)] transition`}>
              {body}
            </button>
          ) : (
            <div key={x.label} className={`${card} p-4`}>{body}</div>
          );
        })}
      </div>

      <section>
        <h2 className="font-display font-bold mb-3">بهترین همکاران (کمیسیون خالص)</h2>
        {data.top.length === 0 ? (
          <div className="text-dim text-[.85rem]">هنوز کمیسیونی ثبت نشده.</div>
        ) : (
          <div className="grid gap-2">
            {data.top.map((a, i) => (
              <Link
                key={a.userId ?? i}
                href={a.userId ? `/admin/affiliate/${a.userId}` : "#"}
                className={`${card} p-3.5 grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-4 gap-y-1 text-[.85rem] hover:border-[rgba(56,225,255,.4)]`}
              >
                <span className="w-7 h-7 rounded-full bg-[rgba(56,225,255,.12)] text-cyan grid place-items-center font-bold text-[.8rem]">
                  {toPersianDigits(i + 1)}
                </span>
                <span className="min-w-0">
                  <bdi className="text-cyan font-bold">{a.mobile}</bdi>
                  {a.code && (
                    <>
                      {" · "}
                      <bdi className="latin text-dim">{a.code}</bdi>
                    </>
                  )}
                </span>
                <span className="col-start-2 sm:col-start-auto text-dim">زیرمجموعه: {toPersianDigits(a.referrals)}</span>
                <span className="col-start-2 sm:col-start-auto text-dim">فروش: {a.sales}</span>
                <span className="col-start-2 sm:col-start-auto font-bold text-[#3ddc84]">{a.netCommission}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
