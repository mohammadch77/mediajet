import { NextRequest, NextResponse } from "next/server";
import type { AffiliatePayoutStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { parsePageParams, paginatedResult } from "@/lib/pagination";

const VALID_STATUSES: AffiliatePayoutStatus[] = ["requested", "paid", "rejected"];

// GET /api/admin/affiliate/payouts?status=&page=
// درخواست‌های تسویه‌ی همکاری. فقط admin؛ شماره کارت کامل فقط این‌جا (برای واریز) نشان داده می‌شود.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const statusParam = req.nextUrl.searchParams.get("status");
  if (statusParam && !VALID_STATUSES.includes(statusParam as AffiliatePayoutStatus)) {
    return NextResponse.json({ error: "وضعیت نامعتبر است." }, { status: 400 });
  }

  const params = parsePageParams(req);
  const where: Prisma.AffiliatePayoutWhereInput = statusParam ? { status: statusParam as AffiliatePayoutStatus } : {};

  const [total, payouts] = await Promise.all([
    prisma.affiliatePayout.count({ where }),
    prisma.affiliatePayout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: {
        user: {
          select: {
            id: true,
            mobile: true,
            name: true,
            affiliateAccount: { select: { balanceRial: true } },
            _count: { select: { fraudFlags: { where: { resolvedAt: null } } } },
          },
        },
        reviewedBy: { select: { mobile: true } },
      },
    }),
  ]);

  return NextResponse.json(
    paginatedResult(
      payouts.map((p) => ({
        id: p.id,
        amountLabel: rialToTomanLabel(Number(p.amountRial)),
        cardNumber: p.cardNumber,
        cardHolder: p.cardHolder,
        status: p.status,
        bankRef: p.bankRef,
        adminNote: p.adminNote,
        createdAt: p.createdAt.toISOString(),
        reviewedAt: p.reviewedAt?.toISOString() ?? null,
        reviewedByMobile: p.reviewedBy?.mobile ?? null,
        user: {
          id: p.user.id,
          mobile: p.user.mobile,
          name: p.user.name,
          balanceLabel: rialToTomanLabel(Number(p.user.affiliateAccount?.balanceRial ?? 0n)),
          openFlags: p.user._count.fraudFlags,
        },
      })),
      total,
      params,
    ),
  );
}
