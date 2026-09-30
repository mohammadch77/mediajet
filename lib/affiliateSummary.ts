// داده‌ی صفحه‌ی همکاری در فروش برای کاربر جاری. فقط سمت سرور؛ فقط داده‌ی خودِ کاربر.

import { prisma } from "./db";
import { getPaymentSettings } from "./paymentSettings";
import { rialToTomanLabel } from "./money";
import { maskCardNumber } from "./affiliate";

export type AffiliateProgramInfo = {
  commissionPercent: number;
  minPayoutRial: string;
  minPayoutLabel: string;
};

export async function getProgramInfo(): Promise<AffiliateProgramInfo> {
  const s = await getPaymentSettings();
  return {
    commissionPercent: s.affiliateCommissionPercent,
    minPayoutRial: s.affiliateMinPayoutRial.toString(),
    minPayoutLabel: rialToTomanLabel(Number(s.affiliateMinPayoutRial)),
  };
}

/** موبایل زیرمجموعه به‌صورت ماسک‌شده؛ همکار نباید شماره‌ی کامل مشتری را ببیند. */
function maskMobile(mobile: string): string {
  return `${mobile.slice(0, 4)}***${mobile.slice(-2)}`;
}

export async function getAffiliateDashboard(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      referralCode: true,
      affiliateJoinedAt: true,
      affiliateSuspendedAt: true,
      affiliateSuspendReason: true,
      affiliateAccount: true,
    },
  });
  if (!user.referralCode || !user.affiliateJoinedAt) return null;

  const accountId = user.affiliateAccount?.id;
  const [pending, referralsCount, earned, commissions, payouts] = await Promise.all([
    prisma.affiliatePendingCommission.aggregate({
      where: { affiliateId: userId, status: "pending" },
      _sum: { amountRial: true },
      _count: true,
    }),
    prisma.user.count({ where: { referredById: userId } }),
    accountId
      ? prisma.affiliateLedger.groupBy({
          by: ["type"],
          where: { accountId, type: { in: ["commission", "commission_reversal"] } },
          _sum: { amountRial: true },
        })
      : [],
    accountId
      ? prisma.affiliateLedger.findMany({
          where: { accountId, type: { in: ["commission", "commission_reversal", "adjustment_credit", "adjustment_debit"] } },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : [],
    prisma.affiliatePayout.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const sourceIds = Array.from(new Set(commissions.map((c) => c.sourceUserId).filter((x): x is string => !!x)));
  const sources = sourceIds.length
    ? await prisma.user.findMany({ where: { id: { in: sourceIds } }, select: { id: true, mobile: true } })
    : [];
  const mobileById = new Map(sources.map((u) => [u.id, u.mobile]));

  const balance = user.affiliateAccount?.balanceRial ?? 0n;
  const sumOf = (type: string) => earned.find((g) => g.type === type)?._sum.amountRial ?? 0n;
  // کمیسیون خالص: کمیسیون‌ها منهای برگشتی‌های ناشی از بازگشت وجه.
  const totalEarned = sumOf("commission") - sumOf("commission_reversal");
  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amountRial, 0n);

  return {
    code: user.referralCode,
    joinedAt: user.affiliateJoinedAt.toISOString(),
    suspended: !!user.affiliateSuspendedAt,
    suspendReason: user.affiliateSuspendReason,
    referralsCount,
    balanceRial: balance.toString(),
    balanceLabel: rialToTomanLabel(Number(balance)),
    pendingLabel: rialToTomanLabel(Number(pending._sum.amountRial ?? 0n)),
    pendingCount: pending._count,
    totalEarnedLabel: rialToTomanLabel(Number(totalEarned)),
    totalPaidLabel: rialToTomanLabel(Number(totalPaid)),
    hasOpenPayout: payouts.some((p) => p.status === "requested"),
    commissions: commissions.map((c) => ({
      id: c.id,
      reversal: c.type === "commission_reversal" || c.type === "adjustment_debit",
      amountLabel: rialToTomanLabel(Number(c.amountRial)),
      baseLabel: c.baseRial !== null ? rialToTomanLabel(Number(c.baseRial)) : null,
      percent: c.percent,
      note: c.note,
      referral: c.sourceUserId ? maskMobile(mobileById.get(c.sourceUserId) ?? "") : null,
      createdAt: c.createdAt.toISOString(),
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      amountLabel: rialToTomanLabel(Number(p.amountRial)),
      card: maskCardNumber(p.cardNumber),
      status: p.status,
      bankRef: p.bankRef,
      adminNote: p.adminNote,
      createdAt: p.createdAt.toISOString(),
      reviewedAt: p.reviewedAt?.toISOString() ?? null,
    })),
  };
}

export type AffiliateDashboard = NonNullable<Awaited<ReturnType<typeof getAffiliateDashboard>>>;
