import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";

const label = (r: bigint) => rialToTomanLabel(Number(r));
const DAY = 24 * 60 * 60 * 1000;

// GET /api/admin/affiliate/report
// گزارش کلی همکاری در فروش برای داشبورد ادمین. فقط admin. همه‌ی مبالغ از دفتر (BigInt ریال) جمع می‌شوند.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const since30 = new Date(Date.now() - 30 * DAY);
  const [
    ledgerByType,
    ledger30,
    pending,
    paid,
    openPayouts,
    positive,
    negative,
    debtors,
    affiliatesCount,
    suspendedCount,
    referralsCount,
    referrals30,
    openFlags,
    topRaw,
  ] = await Promise.all([
    prisma.affiliateLedger.groupBy({ by: ["type"], _sum: { amountRial: true } }),
    prisma.affiliateLedger.groupBy({ by: ["type"], where: { createdAt: { gte: since30 } }, _sum: { amountRial: true } }),
    prisma.affiliatePendingCommission.aggregate({ where: { status: "pending" }, _sum: { amountRial: true }, _count: true }),
    prisma.affiliatePayout.aggregate({ where: { status: "paid" }, _sum: { amountRial: true }, _count: true }),
    prisma.affiliatePayout.aggregate({ where: { status: "requested" }, _sum: { amountRial: true }, _count: true }),
    prisma.affiliateAccount.aggregate({ where: { balanceRial: { gt: 0 } }, _sum: { balanceRial: true } }),
    prisma.affiliateAccount.aggregate({ where: { balanceRial: { lt: 0 } }, _sum: { balanceRial: true } }),
    prisma.affiliateAccount.count({ where: { balanceRial: { lt: 0 } } }),
    prisma.user.count({ where: { affiliateJoinedAt: { not: null } } }),
    prisma.user.count({ where: { affiliateSuspendedAt: { not: null } } }),
    prisma.user.count({ where: { referredById: { not: null } } }),
    prisma.user.count({ where: { referredById: { not: null }, createdAt: { gte: since30 } } }),
    prisma.affiliateFraudFlag.count({ where: { resolvedAt: null } }),
    prisma.affiliateLedger.groupBy({
      by: ["accountId", "type"],
      where: { type: { in: ["commission", "commission_reversal"] } },
      _sum: { amountRial: true, baseRial: true },
    }),
  ]);

  const sumType = (rows: typeof ledgerByType, t: string) => rows.find((r) => r.type === t)?._sum.amountRial ?? 0n;
  const net = sumType(ledgerByType, "commission") - sumType(ledgerByType, "commission_reversal");
  const net30 = sumType(ledger30, "commission") - sumType(ledger30, "commission_reversal");

  // بهترین همکاران: کمیسیون خالص و فروش خالص زیرمجموعه‌ها (مبنای کمیسیون = قیمت پایه‌ی سفارش‌ها).
  const byAccount = new Map<string, { net: bigint; sales: bigint }>();
  for (const r of topRaw) {
    const cur = byAccount.get(r.accountId) ?? { net: 0n, sales: 0n };
    const sign = r.type === "commission" ? 1n : -1n;
    cur.net += sign * (r._sum.amountRial ?? 0n);
    cur.sales += sign * (r._sum.baseRial ?? 0n);
    byAccount.set(r.accountId, cur);
  }
  const top = Array.from(byAccount.entries())
    .sort((a, b) => (b[1].net > a[1].net ? 1 : b[1].net < a[1].net ? -1 : 0))
    .slice(0, 10);
  const accounts = top.length
    ? await prisma.affiliateAccount.findMany({
        where: { id: { in: top.map(([id]) => id) } },
        select: {
          id: true,
          user: { select: { id: true, mobile: true, name: true, referralCode: true, _count: { select: { referrals: true } } } },
        },
      })
    : [];
  const userOf = new Map(accounts.map((a) => [a.id, a.user]));

  return NextResponse.json({
    totals: {
      netCommission: label(net),
      netCommission30: label(net30),
      pending: label(pending._sum.amountRial ?? 0n),
      pendingCount: pending._count,
      paidOut: label(paid._sum.amountRial ?? 0n),
      paidCount: paid._count,
      openPayouts: label(openPayouts._sum.amountRial ?? 0n),
      openPayoutsCount: openPayouts._count,
      withdrawable: label(positive._sum.balanceRial ?? 0n),
      debt: label(-(negative._sum.balanceRial ?? 0n)),
      debtorsCount: debtors,
      affiliatesCount,
      suspendedCount,
      referralsCount,
      referrals30,
      openFlags,
    },
    top: top.map(([accountId, v]) => {
      const u = userOf.get(accountId);
      return {
        userId: u?.id ?? null,
        mobile: u?.mobile ?? "—",
        name: u?.name ?? null,
        code: u?.referralCode ?? null,
        referrals: u?._count.referrals ?? 0,
        netCommission: label(v.net),
        sales: label(v.sales),
      };
    }),
  });
}
