import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { ensureWallet } from "@/lib/wallet";

const HISTORY_LIMIT = 30;

// GET /api/admin/wallets/:userId
// موجودی و آخرین تراکنش‌های کیف پول یک کاربر برای پنل مدیریت. فقط admin.
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
  }

  await ensureWallet(user.id);
  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId: user.id },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT } },
  });

  return NextResponse.json({
    user: { id: user.id, mobile: user.mobile, name: user.name },
    balanceRial: wallet.balanceRial.toString(),
    balanceLabel: rialToTomanLabel(Number(wallet.balanceRial)),
    transactions: wallet.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountLabel: rialToTomanLabel(Number(t.amountRial)),
      balanceAfterLabel: rialToTomanLabel(Number(t.balanceAfter)),
      note: t.note,
      byAdmin: t.ref?.startsWith("admin:") ?? false,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
