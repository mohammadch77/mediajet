import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { parsePageParams, paginatedResult } from "@/lib/pagination";

// GET /api/admin/affiliate/affiliates?q=&page=
// لیست همکاران با آمار هرکدام (زیرمجموعه، موجودی، کمیسیون خالص، واریزشده). فقط admin.
// q روی موبایل، نام یا کد همکاری جست‌وجو می‌کند.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const params = parsePageParams(req);
  const where: Prisma.UserWhereInput = {
    affiliateJoinedAt: { not: null },
    ...(q && {
      OR: [
        { mobile: { contains: q } },
        { name: { contains: q, mode: "insensitive" } },
        { referralCode: { contains: q.toUpperCase() } },
      ],
    }),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { affiliateJoinedAt: "desc" },
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        mobile: true,
        name: true,
        referralCode: true,
        affiliateJoinedAt: true,
        affiliateSuspendedAt: true,
        affiliateAccount: { select: { id: true, balanceRial: true } },
        _count: { select: { referrals: true } },
      },
    }),
  ]);

  const userIds = users.map((u) => u.id);
  const accountIds = users.map((u) => u.affiliateAccount?.id).filter((x): x is string => !!x);

  const [ledgerSums, paidSums] = await Promise.all([
    accountIds.length
      ? prisma.affiliateLedger.groupBy({
          by: ["accountId", "type"],
          where: { accountId: { in: accountIds }, type: { in: ["commission", "commission_reversal"] } },
          _sum: { amountRial: true },
        })
      : [],
    userIds.length
      ? prisma.affiliatePayout.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, status: "paid" },
          _sum: { amountRial: true },
        })
      : [],
  ]);

  const sum = (accountId: string | undefined, type: string) =>
    ledgerSums.find((g) => g.accountId === accountId && g.type === type)?._sum.amountRial ?? 0n;

  return NextResponse.json(
    paginatedResult(
      users.map((u) => {
        const accountId = u.affiliateAccount?.id;
        const net = sum(accountId, "commission") - sum(accountId, "commission_reversal");
        const paid = paidSums.find((p) => p.userId === u.id)?._sum.amountRial ?? 0n;
        return {
          id: u.id,
          mobile: u.mobile,
          name: u.name,
          code: u.referralCode,
          joinedAt: u.affiliateJoinedAt!.toISOString(),
          suspended: !!u.affiliateSuspendedAt,
          referralsCount: u._count.referrals,
          balanceLabel: rialToTomanLabel(Number(u.affiliateAccount?.balanceRial ?? 0n)),
          netEarnedLabel: rialToTomanLabel(Number(net)),
          paidLabel: rialToTomanLabel(Number(paid)),
        };
      }),
      total,
      params,
    ),
  );
}
