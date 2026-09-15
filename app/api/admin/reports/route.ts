import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { categoryById } from "@/data/categories";

// سفارش‌هایی که کیف‌پول برایشان کسر شده (یعنی پرداخت انجام شده)، صرف‌نظر از وضعیت فعلی.
const PAID_STATUSES = ["queued", "processing", "ready", "delivered", "failed", "refunded"] as const;

const querySchema = z
  .object({
    range: z.enum(["today", "week", "month", "custom"]).default("week"),
    from: z.string().optional(),
    to: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.range === "custom") {
      if (!val.from || Number.isNaN(Date.parse(val.from))) {
        ctx.addIssue({ code: "custom", message: "تاریخ شروع نامعتبر است.", path: ["from"] });
      }
      if (!val.to || Number.isNaN(Date.parse(val.to))) {
        ctx.addIssue({ code: "custom", message: "تاریخ پایان نامعتبر است.", path: ["to"] });
      }
    }
  });

function resolveRange(input: z.infer<typeof querySchema>): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  if (input.range === "custom") {
    const from = new Date(input.from!);
    from.setHours(0, 0, 0, 0);
    const customTo = new Date(input.to!);
    customTo.setHours(23, 59, 59, 999);
    return { from, to: customTo };
  }

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (input.range === "week") {
    from.setDate(from.getDate() - 6);
  } else if (input.range === "month") {
    from.setDate(from.getDate() - 29);
  }
  return { from, to };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GET /api/admin/reports?range=today|week|month|custom&from=&to=
// گزارش مالی و آماری کامل ادمین: درآمد، سفارش‌ها، کاربران، کیف پول. فقط admin.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const parsed = querySchema.safeParse({
    range: req.nextUrl.searchParams.get("range") ?? undefined,
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "بازه‌ی زمانی نامعتبر است." }, { status: 400 });
  }

  const { from, to } = resolveRange(parsed.data);

  const [
    ordersInRange,
    ordersByStatusAll,
    newUsers,
    creditAgg,
    debitAgg,
    walletsSum,
    topUsersRaw,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { id: true, priceRial: true, status: true, category: true, sourceSite: true, createdAt: true, userId: true },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.walletTransaction.aggregate({
      where: { type: "credit", createdAt: { gte: from, lte: to } },
      _sum: { amountRial: true },
    }),
    prisma.walletTransaction.aggregate({
      where: { type: "debit", createdAt: { gte: from, lte: to } },
      _sum: { amountRial: true },
    }),
    prisma.wallet.aggregate({ _sum: { balanceRial: true } }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),
  ]);

  // درآمد فقط از سفارش‌های پرداخت‌شده (کسرشده از کیف‌پول) محاسبه می‌شود.
  const paidOrdersInRange = ordersInRange.filter((o) => (PAID_STATUSES as readonly string[]).includes(o.status));
  const totalRevenueRial = paidOrdersInRange.reduce((sum, o) => sum + o.priceRial, 0n);

  // نمودار روند درآمد: به تفکیک روز در بازه‌ی انتخاب‌شده.
  const dayBuckets: { date: string; revenueRial: string; orderCount: number }[] = [];
  const bucketMap = new Map<string, { revenueRial: bigint; orderCount: number }>();
  for (let d = new Date(from); d.getTime() <= to.getTime(); d.setDate(d.getDate() + 1)) {
    const key = dayKey(d);
    bucketMap.set(key, { revenueRial: 0n, orderCount: 0 });
  }
  for (const o of ordersInRange) {
    const key = dayKey(o.createdAt);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    bucket.orderCount += 1;
    if ((PAID_STATUSES as readonly string[]).includes(o.status)) {
      bucket.revenueRial += o.priceRial;
    }
  }
  for (const [date, b] of bucketMap) {
    dayBuckets.push({ date, revenueRial: b.revenueRial.toString(), orderCount: b.orderCount });
  }

  const statusCounts: Record<string, number> = {};
  for (const g of ordersByStatusAll) {
    statusCounts[g.status] = g._count._all;
  }

  // پرسفارش‌ترین دسته‌ها در بازه.
  const categoryCounts = new Map<string, number>();
  const siteCounts = new Map<string, number>();
  for (const o of ordersInRange) {
    categoryCounts.set(o.category, (categoryCounts.get(o.category) ?? 0) + 1);
    siteCounts.set(o.sourceSite, (siteCounts.get(o.sourceSite) ?? 0) + 1);
  }
  const byCategory = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, title: categoryById(category)?.title ?? category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const bySite = Array.from(siteCounts.entries())
    .map(([site, count]) => ({ site, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topUserIds = topUsersRaw.map((u) => u.userId);
  const topUserRecords = topUserIds.length
    ? await prisma.user.findMany({ where: { id: { in: topUserIds } }, select: { id: true, mobile: true, name: true } })
    : [];
  const topUserMap = new Map(topUserRecords.map((u) => [u.id, u]));
  const mostActiveUsers = topUsersRaw.map((u) => ({
    id: u.userId,
    mobile: topUserMap.get(u.userId)?.mobile ?? "",
    name: topUserMap.get(u.userId)?.name ?? null,
    orderCount: u._count._all,
  }));

  const totalChargedRial = creditAgg._sum.amountRial ?? 0n;
  const totalSpentRial = debitAgg._sum.amountRial ?? 0n;
  // موجودی معلق = مجموع فعلیِ موجودیِ همه‌ی کیف‌پول‌ها (شارژشده ولی هنوز خرج‌نشده)، مستقل از بازه‌ی انتخابی
  // چون این عدد یک وضعیت لحظه‌ای است، نه آماری برای یک بازه‌ی زمانی.
  const pendingBalanceRial = walletsSum._sum.balanceRial ?? 0n;

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    revenue: {
      totalRial: totalRevenueRial.toString(),
      trend: dayBuckets,
    },
    orders: {
      totalInRange: ordersInRange.length,
      byStatus: statusCounts,
      byCategory,
      bySite,
    },
    users: {
      newUsers,
      mostActive: mostActiveUsers,
    },
    wallet: {
      totalChargedRial: totalChargedRial.toString(),
      totalSpentRial: totalSpentRial.toString(),
      pendingBalanceRial: pendingBalanceRial.toString(),
    },
  });
}
