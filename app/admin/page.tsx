"use client";
import { useEffect, useState } from "react";
import { rialToTomanLabel, toPersianDigits } from "@/lib/money";
import { toJalaliDate } from "@/lib/jalali";
import { STATUS_LABELS, type OrderStatus } from "@/lib/orderState";

type Stats = {
  totalUsers: number;
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  totalRevenueRial: string;
  totalWalletBalanceRial: string;
  recentOrdersByDay: { date: string; count: number }[];
};

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-dim text-[.82rem] font-semibold">{label}</span>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
      </div>
      <div className="font-display text-[1.5rem] sm:text-[1.8rem] font-extrabold">{value}</div>
      {hint && <div className="text-dim text-[.75rem] mt-1.5">{hint}</div>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "خطا در دریافت آمار.");
        setStats(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطا در دریافت آمار.");
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4">
        {error}
      </div>
    );
  }

  if (!stats) {
    return <div className="text-dim">در حال بارگذاری آمار...</div>;
  }

  const activeOrders =
    (stats.ordersByStatus.queued ?? 0) + (stats.ordersByStatus.processing ?? 0) + (stats.ordersByStatus.ready ?? 0);

  const maxCount = Math.max(1, ...stats.recentOrdersByDay.map((d) => d.count));

  const statusOrder: OrderStatus[] = [
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

  return (
    <div>
      <div className="mb-8">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Dashboard</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">داشبورد کلی</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="تعداد کل کاربران"
          value={toPersianDigits(stats.totalUsers.toLocaleString("en-US"))}
          accent="#38E1FF"
        />
        <StatCard
          label="تعداد کل سفارش‌ها"
          value={toPersianDigits(stats.totalOrders.toLocaleString("en-US"))}
          hint={`${toPersianDigits(activeOrders)} سفارش در جریان`}
          accent="#8A7CFF"
        />
        <StatCard label="درآمد کل" value={rialToTomanLabel(Number(stats.totalRevenueRial))} accent="#FF6B35" />
        <StatCard
          label="موجودی کل کیف‌پول‌ها"
          value={rialToTomanLabel(Number(stats.totalWalletBalanceRial))}
          accent="#FF9A5C"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
        <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-5 sm:p-6">
          <h2 className="font-display font-bold mb-6">سفارش‌های ۷ روز اخیر</h2>
          <div className="flex items-end gap-2 sm:gap-4 h-[180px]">
            {stats.recentOrdersByDay.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[.72rem] text-dim font-bold">{toPersianDigits(d.count)}</span>
                <div
                  className="w-full max-w-[36px] rounded-t-lg bg-gradient-to-t from-primary to-cyan transition-all"
                  style={{ height: `${Math.max(4, (d.count / maxCount) * 100)}%` }}
                />
                <span className="text-[.68rem] text-dim">{toJalaliDate(d.date).slice(5)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-5 sm:p-6">
          <h2 className="font-display font-bold mb-5">سفارش‌ها به تفکیک وضعیت</h2>
          <div className="flex flex-col gap-3">
            {statusOrder.map((s) => {
              const count = stats.ordersByStatus[s] ?? 0;
              const pct = stats.totalOrders > 0 ? (count / stats.totalOrders) * 100 : 0;
              return (
                <div key={s}>
                  <div className="flex items-center justify-between text-[.8rem] mb-1">
                    <span className="text-dim">{STATUS_LABELS[s]}</span>
                    <span className="font-bold">{toPersianDigits(count)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[rgb(var(--c-ov)/.06)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary2"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
