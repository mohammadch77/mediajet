import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getGateway, buildCallbackUrl, GatewayError } from "@/lib/gateway";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { getOrderPayQuote, OrderPayError } from "@/lib/orderPay";
import { rialToTomanLabel } from "@/lib/money";

// پرداخت مجدد یک مسیر حساس مالی است: حداکثر ۱۰ تلاش در دقیقه برای هر کاربر.
const REPAY_RATE_LIMIT = 10;
const REPAY_RATE_WINDOW_MS = 60_000;

class OrderNotPayableError extends Error {}

// POST /api/orders/:id/pay
// برای یک سفارش «در انتظار پرداخت» (پرداخت درگاهیِ ناتمام) تلاش پرداخت تازه می‌سازد و کاربر را
// به درگاه می‌فرستد. مبلغ همیشه از خود سفارش (سمت سرور) خوانده می‌شود، نه از ورودی کلاینت.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای پرداخت سفارش باید وارد شوید." }, { status: 401 });
  }

  const limit = checkRateLimit(`order-repay:${currentUser.id}`, REPAY_RATE_LIMIT, REPAY_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  const { id } = await params;
  const notPayable = NextResponse.json({ error: "این سفارش دیگر قابل پرداخت نیست." }, { status: 409 });

  // فقط سفارشِ خودِ کاربر؛ سفارش دیگران مثل سفارش ناموجود جواب می‌دهد.
  const order = await prisma.order.findFirst({ where: { id, userId: currentUser.id } });
  if (!order) {
    return NextResponse.json({ error: "سفارش یافت نشد." }, { status: 404 });
  }
  if (order.status !== "awaiting_payment" || order.paymentMethod !== "gateway") {
    return notPayable;
  }

  let attempt;
  try {
    const gateway = await getGateway();
    attempt = await gateway.requestPayment(
      order.totalPriceRial,
      buildCallbackUrl("/api/orders/payment/callback", _req.url),
      "پرداخت سفارش گت‌استوک",
    );
  } catch (error) {
    if (error instanceof GatewayError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // قفل ردیف سفارش: با callback هم‌زمان درگاه (confirmOrderPayment) سریالی می‌شود.
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT status::text AS status FROM "Order" WHERE id = ${order.id} FOR UPDATE
      `;
      if (rows[0]?.status !== "awaiting_payment") {
        throw new OrderNotPayableError();
      }

      // فقط یک تلاش باز: تلاش‌های قبلی ناموفق می‌شوند تا callback دیرهنگامشان اثری نداشته باشد.
      await tx.payment.updateMany({
        where: { orderId: order.id, status: "initiated" },
        data: { status: "failed" },
      });
      await tx.payment.create({
        data: {
          userId: currentUser.id,
          orderId: order.id,
          amountRial: order.totalPriceRial,
          status: "initiated",
          authority: attempt.authority,
          redirectUrl: attempt.redirectUrl,
          idempotencyKey: `order-repay:${order.id}:${crypto.randomUUID()}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof OrderNotPayableError) {
      return notPayable;
    }
    throw error;
  }

  return NextResponse.json({ redirectUrl: attempt.redirectUrl });
}

// GET /api/orders/:id/pay — قیمت سفارش با هر دو روش پرداخت و موجودی کیف پول (برای انتخاب روش پرداخت)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای پرداخت سفارش باید وارد شوید." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const quote = await getOrderPayQuote(currentUser.id, id);
    return NextResponse.json({
      walletTotalRial: quote.walletTotalRial.toString(),
      walletTotalLabel: rialToTomanLabel(Number(quote.walletTotalRial)),
      gatewayTotalRial: quote.gatewayTotalRial.toString(),
      gatewayTotalLabel: rialToTomanLabel(Number(quote.gatewayTotalRial)),
      walletBalanceRial: quote.walletBalanceRial.toString(),
      walletBalanceLabel: rialToTomanLabel(Number(quote.walletBalanceRial)),
    });
  } catch (error) {
    if (error instanceof OrderPayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
