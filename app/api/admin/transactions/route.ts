import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { parsePageParams, paginatedResult } from "@/lib/pagination";
import type { Prisma, TxType } from "@prisma/client";

const VALID_TYPES: TxType[] = ["credit", "debit"];

// GET /api/admin/transactions?type=&page=&pageSize=
// همه‌ی تراکنش‌های کیف پول با فیلتر نوع و صفحه‌بندی. فقط admin.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const typeParam = req.nextUrl.searchParams.get("type");
  if (typeParam && !VALID_TYPES.includes(typeParam as TxType)) {
    return NextResponse.json({ error: "نوع تراکنش نامعتبر است." }, { status: 400 });
  }

  const params = parsePageParams(req);
  const where: Prisma.WalletTransactionWhereInput = typeParam ? { type: typeParam as TxType } : {};

  const [total, transactions] = await Promise.all([
    prisma.walletTransaction.count({ where }),
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: { wallet: { include: { user: true } } },
    }),
  ]);

  return NextResponse.json(
    paginatedResult(
      transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amountLabel: rialToTomanLabel(Number(t.amountRial)),
        balanceAfterLabel: rialToTomanLabel(Number(t.balanceAfter)),
        ref: t.ref,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
        user: { id: t.wallet.user.id, mobile: t.wallet.user.mobile, name: t.wallet.user.name },
      })),
      total,
      params
    )
  );
}
