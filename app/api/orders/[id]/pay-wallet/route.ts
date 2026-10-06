import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { payOrderWithWallet, OrderPayError } from "@/lib/orderPay";
import { notifyOrderCreated } from "@/lib/telegram";
import { rialToTomanLabel } from "@/lib/money";

// پرداخت مالی است: حداکثر ۱۰ تلاش در دقیقه برای هر کاربر.
const WALLET_PAY_RATE_LIMIT = 10;
const WALLET_PAY_RATE_WINDOW_MS = 60_000;

// POST /api/orders/:id/pay-wallet
// پرداخت سفارش «در انتظار پرداخت» از کیف پول. هویت از session، قیمت فقط سمت سرور.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای پرداخت سفارش باید وارد شوید." }, { status: 401 });
  }

  const limit = checkRateLimit(`order-wallet-pay:${currentUser.id}`, WALLET_PAY_RATE_LIMIT, WALLET_PAY_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  const { id } = await params;
  try {
    const result = await payOrderWithWallet(currentUser.id, id);
    notifyOrderCreated({
      orderId: result.orderId,
      priceLabel: rialToTomanLabel(Number(result.priceRial)),
      items: result.productUrls.map((productUrl) => ({ productUrl })),
    });
    return NextResponse.json({
      orderId: result.orderId,
      priceLabel: rialToTomanLabel(Number(result.priceRial)),
      walletBalanceLabel: rialToTomanLabel(Number(result.balanceAfterRial)),
    });
  } catch (error) {
    if (error instanceof OrderPayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
