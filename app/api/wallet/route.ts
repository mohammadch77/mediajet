import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rialToTomanLabel } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";
import { getPaymentSettings } from "@/lib/paymentSettings";

// GET /api/wallet
// موجودی و تاریخچه‌ی تراکنش‌های کیف پول کاربر جاری (فقط تراکنش‌های خودش).
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای مشاهده‌ی کیف پول باید وارد شوید." }, { status: 401 });
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: currentUser.id },
    include: { transactions: { orderBy: { createdAt: "desc" } } },
  });

  if (!wallet) {
    return NextResponse.json({ error: "کیف پول یافت نشد." }, { status: 404 });
  }

  // حداقل مبلغ شارژ عمومی و غیرحساس است؛ برای نمایش در فرم شارژ به کلاینت برمی‌گردد.
  const { walletMinChargeRial } = await getPaymentSettings();

  return NextResponse.json({
    balanceRial: wallet.balanceRial.toString(),
    balanceLabel: rialToTomanLabel(Number(wallet.balanceRial)),
    walletMinChargeRial: walletMinChargeRial.toString(),
    walletMinChargeLabel: rialToTomanLabel(Number(walletMinChargeRial)),
    transactions: wallet.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amountRial: t.amountRial.toString(),
      amountLabel: rialToTomanLabel(Number(t.amountRial)),
      balanceAfter: t.balanceAfter.toString(),
      balanceAfterLabel: rialToTomanLabel(Number(t.balanceAfter)),
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
