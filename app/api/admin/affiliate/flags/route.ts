import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { parsePageParams, paginatedResult } from "@/lib/pagination";
import { FRAUD_KIND_LABELS } from "@/lib/affiliateFraud";

// GET /api/admin/affiliate/flags?status=open|resolved&affiliateId=&page=
// هشدارهای خودکار تقلب همکاری. فقط admin.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const affiliateId = req.nextUrl.searchParams.get("affiliateId");
  const params = parsePageParams(req);
  const where: Prisma.AffiliateFraudFlagWhereInput = {
    resolvedAt: status === "resolved" ? { not: null } : null,
    ...(affiliateId && { affiliateId }),
  };

  const [total, flags] = await Promise.all([
    prisma.affiliateFraudFlag.count({ where }),
    prisma.affiliateFraudFlag.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: {
        affiliate: { select: { id: true, mobile: true, referralCode: true, affiliateSuspendedAt: true } },
        resolvedBy: { select: { mobile: true } },
      },
    }),
  ]);

  return NextResponse.json(
    paginatedResult(
      flags.map((f) => ({
        id: f.id,
        kind: f.kind,
        kindLabel: FRAUD_KIND_LABELS[f.kind] ?? f.kind,
        detail: f.detail,
        createdAt: f.createdAt.toISOString(),
        resolvedAt: f.resolvedAt?.toISOString() ?? null,
        resolution: f.resolution,
        resolvedByMobile: f.resolvedBy?.mobile ?? null,
        affiliate: {
          id: f.affiliate.id,
          mobile: f.affiliate.mobile,
          code: f.affiliate.referralCode,
          suspended: !!f.affiliate.affiliateSuspendedAt,
        },
      })),
      total,
      params,
    ),
  );
}
