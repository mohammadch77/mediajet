import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { parsePageParams, paginatedResult } from "@/lib/pagination";

// GET /api/admin/users/:id
// جزئیات یک کاربر به‌همراه سفارش‌ها و تراکنش‌های کیف پول (هر دو صفحه‌بندی‌شده). فقط admin.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { wallet: true },
  });

  if (!user) {
    return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
  }

  const ordersPageParams = parsePageParams(req, "orders");
  const txPageParams = parsePageParams(req, "tx");

  const [orderTotal, orders, txTotal, transactions] = await Promise.all([
    prisma.order.count({ where: { userId: user.id } }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: ordersPageParams.skip,
      take: ordersPageParams.take,
    }),
    user.wallet
      ? prisma.walletTransaction.count({ where: { walletId: user.wallet.id } })
      : Promise.resolve(0),
    user.wallet
      ? prisma.walletTransaction.findMany({
          where: { walletId: user.wallet.id },
          orderBy: { createdAt: "desc" },
          skip: txPageParams.skip,
          take: txPageParams.take,
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    user: {
      id: user.id,
      mobile: user.mobile,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      walletBalanceRial: (user.wallet?.balanceRial ?? 0n).toString(),
    },
    orders: paginatedResult(
      orders.map((o) => ({
        id: o.id,
        category: o.category,
        sourceSite: o.sourceSite,
        priceLabel: rialToTomanLabel(Number(o.priceRial)),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      orderTotal,
      ordersPageParams
    ),
    transactions: paginatedResult(
      transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amountRial: t.amountRial.toString(),
        amountLabel: rialToTomanLabel(Number(t.amountRial)),
        balanceAfterLabel: rialToTomanLabel(Number(t.balanceAfter)),
        ref: t.ref,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
      txTotal,
      txPageParams
    ),
  });
}
