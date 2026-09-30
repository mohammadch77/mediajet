import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orderNumber";
import { FRAUD_KIND_LABELS } from "@/lib/affiliateFraud";
import { AffiliateError, adjustAffiliateBalance, setAffiliateSuspended } from "@/lib/affiliate";
import { validateInput, affiliateAdminActionInput, ValidationError } from "@/lib/validation";

async function guard() {
  try {
    return { admin: await requireAdmin() };
  } catch (error) {
    if (error instanceof SessionError) {
      return { res: NextResponse.json({ error: error.message }, { status: 403 }) };
    }
    throw error;
  }
}

// GET /api/admin/affiliate/affiliates/:id
// جزئیات کامل یک همکار: آمار، زیرمجموعه‌ها، دفتر کمیسیون، تسویه‌ها و لاگ اقدامات ادمین. فقط admin.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.res) return g.res;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { affiliateAccount: true },
  });
  if (!user?.affiliateJoinedAt) {
    return NextResponse.json({ error: "همکار پیدا نشد." }, { status: 404 });
  }

  const accountId = user.affiliateAccount?.id;
  const [pendingRows, flags, referrals, referralsCount, ledger, payouts, logs] = await Promise.all([
    prisma.affiliatePendingCommission.findMany({
      where: { affiliateId: user.id, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.affiliateFraudFlag.findMany({
      where: { affiliateId: user.id },
      orderBy: [{ resolvedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: 50,
      include: { resolvedBy: { select: { mobile: true } } },
    }),
    prisma.user.findMany({
      where: { referredById: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, mobile: true, name: true, createdAt: true, _count: { select: { orders: true } } },
    }),
    prisma.user.count({ where: { referredById: user.id } }),
    accountId
      ? prisma.affiliateLedger.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 100 })
      : [],
    prisma.affiliatePayout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.affiliateAdminLog.findMany({
      where: { targetUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { mobile: true } } },
    }),
  ]);

  const orderIds = [
    ...ledger.map((l) => l.orderId).filter((x): x is string => !!x),
    ...pendingRows.map((p) => p.orderId),
  ];
  const orders = orderIds.length
    ? await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true } })
    : [];
  const orderNo = new Map(orders.map((o) => [o.id, formatOrderNumber(o.orderNumber)]));

  return NextResponse.json({
    affiliate: {
      id: user.id,
      mobile: user.mobile,
      name: user.name,
      code: user.referralCode,
      joinedAt: user.affiliateJoinedAt.toISOString(),
      suspendedAt: user.affiliateSuspendedAt?.toISOString() ?? null,
      suspendReason: user.affiliateSuspendReason,
      balanceLabel: rialToTomanLabel(Number(user.affiliateAccount?.balanceRial ?? 0n)),
      referralsCount,
    },
    pending: pendingRows.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      orderNumber: orderNo.get(p.orderId) ?? null,
      amountLabel: rialToTomanLabel(Number(p.amountRial)),
      percent: p.percent,
      createdAt: p.createdAt.toISOString(),
    })),
    flags: flags.map((f) => ({
      id: f.id,
      kindLabel: FRAUD_KIND_LABELS[f.kind] ?? f.kind,
      detail: f.detail,
      createdAt: f.createdAt.toISOString(),
      resolvedAt: f.resolvedAt?.toISOString() ?? null,
      resolution: f.resolution,
      resolvedByMobile: f.resolvedBy?.mobile ?? null,
    })),
    referrals: referrals.map((r) => ({
      id: r.id,
      mobile: r.mobile,
      name: r.name,
      joinedAt: r.createdAt.toISOString(),
      ordersCount: r._count.orders,
    })),
    ledger: ledger.map((l) => ({
      id: l.id,
      type: l.type,
      amountLabel: rialToTomanLabel(Number(l.amountRial)),
      balanceAfterLabel: rialToTomanLabel(Number(l.balanceAfter)),
      orderId: l.orderId,
      orderNumber: l.orderId ? (orderNo.get(l.orderId) ?? null) : null,
      percent: l.percent,
      note: l.note,
      createdAt: l.createdAt.toISOString(),
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      amountLabel: rialToTomanLabel(Number(p.amountRial)),
      status: p.status,
      bankRef: p.bankRef,
      adminNote: p.adminNote,
      createdAt: p.createdAt.toISOString(),
    })),
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      detail: l.detail,
      actorMobile: l.actor.mobile,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}

// POST /api/admin/affiliate/affiliates/:id
//   { action: "suspend" | "unsuspend", reason }
//   { action: "adjust", direction: "credit" | "debit", amountRial, reason, idempotencyKey }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard();
  if (g.res) return g.res;

  let input;
  try {
    input = validateInput(affiliateAdminActionInput, await req.json());
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    if (input.action === "adjust") {
      await adjustAffiliateBalance(g.admin.id, params.id, {
        direction: input.direction,
        amountRial: BigInt(input.amountRial),
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      });
    } else {
      await setAffiliateSuspended(g.admin.id, params.id, input.action === "suspend", input.reason);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AffiliateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
