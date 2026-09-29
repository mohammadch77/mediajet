import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatOrderNumber } from "@/lib/orderNumber";
import { computeCartTotal } from "@/lib/pricing";
import { rialToTomanLabel } from "@/lib/money";
import { validateInput, cartCheckoutInput, ValidationError } from "@/lib/validation";
import { debitWalletInTx, WalletError } from "@/lib/wallet";
import { assertTransition, type OrderStatus } from "@/lib/orderState";
import { getCurrentUser } from "@/lib/session";
import { notifyOrderCreated } from "@/lib/telegram";
import { getGateway } from "@/lib/gateway";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { getCartItems, clearCartInTx } from "@/lib/cart";

const FOREIGN_KEY_VIOLATION = "P2003";

// تسویه‌ی سبد خرید هم یک مسیر حساس مالی است: حداکثر ۱۰ تلاش در دقیقه برای هر کاربر
// (خواهر همین محدودیت روی /api/orders).
const CHECKOUT_RATE_LIMIT = 10;
const CHECKOUT_RATE_WINDOW_MS = 60_000;

/** کلید یکتای رکورد Payment سفارشِ سبد؛ جدا از کلید سفارش تا با تراکنش کیف پول تداخل نکند. */
function paymentIdempotencyKey(orderIdempotencyKey: string): string {
  return `cart-pay:${orderIdempotencyKey}`;
}

// POST /api/cart/checkout
// تبدیل سبد خرید کاربر جاری به یک سفارش چندآیتمی با دو روش پرداخت:
//   - wallet:  کسر اتمیک کل مبلغ از کیف پول و رفتن مستقیم به صف (draft → awaiting_payment → queued)،
//              سپس خالی شدن سبد در همان تراکنش.
//   - gateway: ساخت سفارش در awaiting_payment و هدایت کاربر به درگاه؛ صف‌شدن و خالی شدن سبد
//              فقط بعد از تأیید پرداخت در callback اتفاق می‌افتد (lib/payment.ts → confirmOrderPayment).
// قیمت کل در هر دو حالت فقط سمت سرور و بر اساس کارمزد همان روش پرداخت دوباره محاسبه می‌شود؛
// قیمت کش‌شده‌ی روی CartItem هرگز مستقیماً به سفارش منتقل نمی‌شود.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای تسویه‌ی سبد خرید باید وارد شوید." }, { status: 401 });
  }

  const limit = checkRateLimit(
    `cart-checkout:${currentUser.id}`,
    CHECKOUT_RATE_LIMIT,
    CHECKOUT_RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(cartCheckoutInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const userId = currentUser.id;
  const { paymentMethod, idempotencyKey } = input;

  // درخواست تکراری: همان سفارش قبلی برگردانده می‌شود، سفارش/کسر/پرداخت جدید ساخته نمی‌شود.
  const existingOrder = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (existingOrder) {
    if (existingOrder.userId !== userId) {
      return NextResponse.json({ error: "کلید یکتای درخواست نامعتبر است." }, { status: 409 });
    }
    return buildResponse(existingOrder, idempotencyKey);
  }

  const cartItems = await getCartItems(userId);
  if (cartItems.length === 0) {
    return NextResponse.json({ error: "سبد خرید خالی است." }, { status: 422 });
  }

  const cartPrice = await computeCartTotal(
    cartItems.map((item) => ({ categoryId: item.category, site: item.sourceSite })),
    paymentMethod,
  );
  if (!cartPrice) {
    return NextResponse.json({ error: "محاسبه‌ی قیمت سبد با خطا مواجه شد." }, { status: 422 });
  }

  const actor = `user:${userId}`;
  const payableTotalRial = BigInt(cartPrice.payableTotalRial);

  // برای پرداخت درگاهی، تلاش پرداخت پیش از تراکنش ساخته می‌شود (همان ترتیب مسیر ثبت سفارش تکی).
  let gatewayAttempt: { authority: string; redirectUrl: string } | null = null;
  if (paymentMethod === "gateway") {
    const callbackUrl = new URL("/api/orders/payment/callback", req.url).toString();
    const gateway = await getGateway();
    gatewayAttempt = await gateway.requestPayment(payableTotalRial, callbackUrl);
  }

  try {
    await prisma.$transaction(async (tx) => {
      // بازبینی داخل تراکنش برای جلوگیری از race بین دو درخواست هم‌زمان با یک idempotencyKey.
      const raced = await tx.order.findUnique({ where: { idempotencyKey } });
      if (raced) {
        return;
      }

      const order = await tx.order.create({
        data: {
          userId,
          totalPriceRial: payableTotalRial,
          paymentMethod,
          status: "draft",
          idempotencyKey,
          cartCheckout: true,
          items: {
            create: cartItems.map((item, i) => ({
              sourceSite: item.sourceSite,
              category: item.category,
              productUrl: item.productUrl,
              priceRial: BigInt(cartPrice.items[i].finalPriceRial),
            })),
          },
        },
      });

      await tx.orderEvent.create({
        data: { orderId: order.id, fromStatus: null, toStatus: "draft", actor },
      });

      await transitionOrder(tx, order.id, "draft", "awaiting_payment", actor);

      if (paymentMethod === "wallet") {
        await debitWalletInTx(
          tx,
          userId,
          payableTotalRial,
          order.id,
          `پرداخت سفارش ${formatOrderNumber(order.orderNumber)}`,
          idempotencyKey,
        );
        await transitionOrder(tx, order.id, "awaiting_payment", "queued", "system");
        await clearCartInTx(tx, userId);
        return;
      }

      // pending: سفارش در awaiting_payment می‌ماند تا callback درگاه آن را تأیید کند؛
      // سبد عمداً دست‌نخورده می‌ماند تا اگر پرداخت ناموفق شد، آیتم‌ها از بین نروند.
      await tx.payment.create({
        data: {
          userId,
          orderId: order.id,
          amountRial: payableTotalRial,
          status: "initiated",
          authority: gatewayAttempt!.authority,
          redirectUrl: gatewayAttempt!.redirectUrl,
          idempotencyKey: paymentIdempotencyKey(idempotencyKey),
        },
      });
    });
  } catch (error) {
    if (error instanceof WalletError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === FOREIGN_KEY_VIOLATION) {
      return NextResponse.json({ error: "کاربر یافت نشد." }, { status: 404 });
    }
    throw error;
  }

  const order = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (!order) {
    return NextResponse.json({ error: "خطای پردازش سفارش" }, { status: 500 });
  }

  if (order.status === "queued") {
    notifyOrderCreated({
      orderId: order.id,
      priceLabel: rialToTomanLabel(Number(order.totalPriceRial)),
      items: cartItems.map((item) => ({ productUrl: item.productUrl })),
    });
  }

  return buildResponse(order, idempotencyKey);
}

async function transitionOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  actor: string,
): Promise<void> {
  assertTransition(from, to);
  await tx.order.update({ where: { id: orderId }, data: { status: to } });
  await tx.orderEvent.create({ data: { orderId, fromStatus: from, toStatus: to, actor } });
}

async function buildResponse(
  order: { id: string; status: string; totalPriceRial: bigint },
  idempotencyKey: string,
) {
  const [walletTransaction, payment] = await Promise.all([
    prisma.walletTransaction.findUnique({ where: { idempotencyKey } }),
    prisma.payment.findUnique({ where: { idempotencyKey: paymentIdempotencyKey(idempotencyKey) } }),
  ]);

  // فقط تا وقتی پرداخت به نتیجه نرسیده، کاربر دوباره به همان صفحه‌ی پرداخت هدایت می‌شود.
  const redirectUrl =
    payment && (payment.status === "initiated" || payment.status === "paid")
      ? payment.redirectUrl
      : null;

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    priceRial: order.totalPriceRial.toString(),
    priceLabel: rialToTomanLabel(Number(order.totalPriceRial)),
    walletBalanceRial: walletTransaction ? walletTransaction.balanceAfter.toString() : null,
    redirectUrl,
  });
}
