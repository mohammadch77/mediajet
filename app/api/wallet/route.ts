import { NextResponse } from "next/server";
import { ensureWallet } from "@/lib/wallet";
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

  // کاربری که کیف پول ندارد (مثلاً ادمین ساخته‌شده با اسکریپت) خطا نمی‌گیرد؛ کیف پول صفر برایش ساخته می‌شود.
  const wallet = await ensureWallet(currentUser.id);

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
