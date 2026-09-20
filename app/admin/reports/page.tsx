"use client";
import { useEffect, useMemo, useState } from "react";
import { rialToTomanLabel, toPersianDigits } from "@/lib/money";
import { toJalaliDate } from "@/lib/jalali";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orderState";

type ReportData = {
  range: { from: string; to: string };
  revenue: { totalRial: string; trend: { date: string; revenueRial: string; orderCount: number }[] };
  orders: {
    totalInRange: number;
    byStatus: Record<string, number>;
    byCategory: { category: string; title: string; count: number }[];
    bySite: { site: string; count: number }[];
    avgItemsPerOrder: number;
    avgOrderValueRial: string;
  };
  users: {
    newUsers: number;
    mostActive: { id: string; mobile: string; name: string | null; orderCount: number }[];
  };
  wallet: { totalChargedRial: string; totalSpentRial: string; pendingBalanceRial: string };
};

type RangeKey = "today" | "week" | "month" | "custom";

const RANGE_LABELS: Record<RangeKey, string> = {
  today: "امروز",
  week: "هفته‌ی اخیر",
  month: "ماه اخیر",
  custom: "دلخواه",
};

const STATUS_ORDER: OrderStatus[] = [
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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        "bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-5 sm:p-6 " +
        className
      }
    >
      {children}
    </div>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-dim text-[.82rem] font-semibold">{label}</span>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accent }} />
      </div>
      <div className="font-display text-[1.35rem] sm:text-[1.6rem] font-extrabold break-words">{value}</div>
      {hint && <div className="text-dim text-[.75rem] mt-1.5">{hint}</div>}
    </Card>
  );
}

export default function AdminReportsPage() {
  const [range, setRange] = useState<RangeKey>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) return;

    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ range });
    if (range === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }

    (async () => {
      try {
        const res = await fetch(`/api/admin/reports?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "خطا در دریافت گزارش.");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطا در دریافت گزارش.");
      } finally {
        setLoading(false);
      }
    })();
  }, [range, customFrom, customTo]);

  const maxRevenue = useMemo(
    () => Math.max(1, ...(data?.revenue.trend.map((d) => Number(d.revenueRial)) ?? [1])),
    [data]
  );
  const maxCategoryCount = useMemo(
    () => Math.max(1, ...(data?.orders.byCategory.map((c) => c.count) ?? [1])),
    [data]
  );

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Reports</div>
          <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">گزارش‌های مالی و آماری</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(RANGE_LABELS) as RangeKey[])
            .filter((k) => k !== "custom")
            .map((k) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={
                  "px-3.5 py-2 rounded-xl text-[.82rem] font-semibold transition " +
                  (range === k
                    ? "bg-gradient-to-br from-primary to-primary2 text-white"
                    : "bg-[rgba(255,255,255,.04)] text-dim hover:text-text")
                }
              >
                {RANGE_LABELS[k]}
              </button>
            ))}
          <button
            onClick={() => setRange("custom")}
            className={
              "px-3.5 py-2 rounded-xl text-[.82rem] font-semibold transition " +
              (range === "custom"
                ? "bg-gradient-to-br from-primary to-primary2 text-white"
                : "bg-[rgba(255,255,255,.04)] text-dim hover:text-text")
            }
          >
            دلخواه
          </button>
        </div>
      </div>

      {range === "custom" && (
        <Card className="mb-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[.82rem] text-dim">
            از
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-[rgba(255,255,255,.05)] border border-[rgba(138,124,255,.2)] rounded-lg px-3 py-1.5 text-text"
            />
          </label>
          <label className="flex items-center gap-2 text-[.82rem] text-dim">
            تا
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-[rgba(255,255,255,.05)] border border-[rgba(138,124,255,.2)] rounded-lg px-3 py-1.5 text-text"
            />
          </label>
          {(!customFrom || !customTo) && (
            <span className="text-[.78rem] text-dim">هر دو تاریخ را انتخاب کنید.</span>
          )}
        </Card>
      )}

      {error && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-6">
          {error}
        </div>
      )}

      {!data && !error && <div className="text-dim">در حال بارگذاری گزارش...</div>}

      {data && (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="text-dim text-[.78rem] mb-4">
            بازه: {toJalaliDate(data.range.from)} تا {toJalaliDate(data.range.to)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <StatCard label="درآمد بازه" value={rialToTomanLabel(Number(data.revenue.totalRial))} accent="#FF6B35" />
            <StatCard
              label="تعداد سفارش‌ها در بازه"
              value={toPersianDigits(data.orders.totalInRange)}
              accent="#8A7CFF"
            />
            <StatCard label="کاربران جدید" value={toPersianDigits(data.users.newUsers)} accent="#38E1FF" />
            <StatCard
              label="موجودی معلق کیف‌پول‌ها"
              value={rialToTomanLabel(Number(data.wallet.pendingBalanceRial))}
              hint="شارژ‌شده ولی هنوز خرج‌نشده — کل، مستقل از بازه"
              accent="#FF9A5C"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="مجموع شارژهای بازه"
              value={rialToTomanLabel(Number(data.wallet.totalChargedRial))}
              accent="#4ADE80"
            />
            <StatCard
              label="مجموع خرج‌های بازه"
              value={rialToTomanLabel(Number(data.wallet.totalSpentRial))}
              accent="#F87171"
            />
            <StatCard
              label="میانگین تعداد آیتم در سفارش"
              value={toPersianDigits(data.orders.avgItemsPerOrder.toFixed(1))}
              accent="#38E1FF"
            />
            <StatCard
              label="میانگین ارزش سفارش"
              value={rialToTomanLabel(Number(data.orders.avgOrderValueRial))}
              hint="بر اساس سفارش‌های پرداخت‌شده در بازه"
              accent="#8A7CFF"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4 mb-8">
            <Card>
              <h2 className="font-display font-bold mb-6">روند درآمد</h2>
              {data.revenue.trend.length === 0 ? (
                <div className="text-dim text-[.85rem]">داده‌ای برای نمایش نیست.</div>
              ) : (
                <div className="flex items-end gap-1.5 sm:gap-2 h-[200px] overflow-x-auto">
                  {data.revenue.trend.map((d) => (
                    <div key={d.date} className="flex-1 min-w-[28px] flex flex-col items-center gap-2 h-full justify-end">
                      <span className="text-[.65rem] text-dim font-bold whitespace-nowrap">
                        {toPersianDigits(Math.round(Number(d.revenueRial) / 10).toLocaleString("en-US"))}
                      </span>
                      <div
                        className="w-full max-w-[32px] rounded-t-lg bg-gradient-to-t from-primary to-cyan transition-all"
                        style={{ height: `${Math.max(4, (Number(d.revenueRial) / maxRevenue) * 100)}%` }}
                      />
                      <span className="text-[.62rem] text-dim">{toJalaliDate(d.date).slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="font-display font-bold mb-5">سفارش‌ها به تفکیک وضعیت (کل)</h2>
              <div className="flex flex-col gap-3">
                {STATUS_ORDER.map((s) => {
                  const count = data.orders.byStatus[s] ?? 0;
                  const total = Object.values(data.orders.byStatus).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={s}>
                      <div className="flex items-center justify-between text-[.8rem] mb-1">
                        <span className="text-dim">{STATUS_LABELS[s]}</span>
                        <span className="font-bold">{toPersianDigits(count)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[rgba(255,255,255,.06)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary2"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-8">
            <Card>
              <h2 className="font-display font-bold mb-5">پرسفارش‌ترین دسته‌ها (بازه)</h2>
              {data.orders.byCategory.length === 0 ? (
                <div className="text-dim text-[.85rem]">سفارشی در این بازه ثبت نشده.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.orders.byCategory.map((c) => (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-[.8rem] mb-1">
                        <span className="text-dim">{c.title}</span>
                        <span className="font-bold">{toPersianDigits(c.count)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[rgba(255,255,255,.06)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan to-primary"
                          style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="font-display font-bold mb-5">سفارش‌ها به تفکیک سایت مبدأ (بازه)</h2>
              {data.orders.bySite.length === 0 ? (
                <div className="text-dim text-[.85rem]">سفارشی در این بازه ثبت نشده.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.orders.bySite.map((s) => (
                    <div
                      key={s.site}
                      className="flex items-center gap-2 bg-[rgba(255,255,255,.04)] rounded-xl px-3 py-2 text-[.78rem]"
                    >
                      <span className="text-dim">{s.site}</span>
                      <span className="font-bold">{toPersianDigits(s.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="font-display font-bold mb-5">فعال‌ترین کاربران (بازه)</h2>
            {data.users.mostActive.length === 0 ? (
              <div className="text-dim text-[.85rem]">کاربری در این بازه سفارش ثبت نکرده.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[.82rem]">
                  <thead>
                    <tr className="text-dim border-b border-[rgba(138,124,255,.14)]">
                      <th className="text-right py-2 font-semibold">کاربر</th>
                      <th className="text-right py-2 font-semibold">موبایل</th>
                      <th className="text-right py-2 font-semibold">تعداد سفارش</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.mostActive.map((u) => (
                      <tr key={u.id} className="border-b border-[rgba(138,124,255,.06)] last:border-0">
                        <td className="py-2.5">{u.name ?? "—"}</td>
                        <td className="py-2.5" dir="ltr">
                          {u.mobile}
                        </td>
                        <td className="py-2.5 font-bold">{toPersianDigits(u.orderCount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
