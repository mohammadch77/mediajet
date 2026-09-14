import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import type { OrderStatus } from "@/lib/orderState";

// سفارش‌هایی که کیف‌پول برایشان کسر شده (یعنی پرداخت انجام شده)، صرف‌نظر از وضعیت فعلی.
const PAID_STATUSES: OrderStatus[] = ["queued", "processing", "ready", "delivered", "failed", "refunded"];

// GET /api/admin/stats
// آمار کلی داشبورد ادمین: کاربران، سفارش‌ها به تفکیک وضعیت، درآمد کل، موجودی کل کیف‌پول‌ها،
// و سفارش‌های ۷ روز اخیر برای نمودار.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const [totalUsers, ordersByStatus, paidOrders, walletsSum] = await Promise.all([
    prisma.user.count(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.findMany({ where: { status: { in: PAID_STATUSES } }, select: { priceRial: true } }),
    prisma.wallet.aggregate({ _sum: { balanceRial: true } }),
  ]);

  const totalOrders = ordersByStatus.reduce((sum, g) => sum + g._count._all, 0);
  const statusCounts: Record<string, number> = {};
  for (const g of ordersByStatus) {
    statusCounts[g.status] = g._count._all;
  }

  const totalRevenueRial = paidOrders.reduce((sum, o) => sum + o.priceRial, 0n);
  const totalWalletBalanceRial = walletsSum._sum.balanceRial ?? 0n;

  // سفارش‌های ۷ روز اخیر برای نمودار، به تفکیک روز
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const recentOrders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const dayBuckets: { date: string; count: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dayBuckets.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  for (const o of recentOrders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const bucket = dayBuckets.find((b) => b.date === key);
    if (bucket) bucket.count += 1;
  }

  return NextResponse.json({
    totalUsers,
    totalOrders,
    ordersByStatus: statusCounts,
    totalRevenueRial: totalRevenueRial.toString(),
    totalWalletBalanceRial: totalWalletBalanceRial.toString(),
    recentOrdersByDay: dayBuckets,
  });
}
