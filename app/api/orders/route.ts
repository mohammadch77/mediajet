import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computePriceForPaymentMethod } from "@/lib/pricing";
import { rialToTomanLabel } from "@/lib/money";
import { validateInput, createOrderInput, ValidationError } from "@/lib/validation";
import { debitWalletInTx, WalletError } from "@/lib/wallet";
import { accrueOrderCommissionInTx } from "@/lib/affiliate";
import { assertTransition, type OrderStatus } from "@/lib/orderState";
import { getCurrentUser } from "@/lib/session";
import { notifyOrderCreated } from "@/lib/telegram";
import { getGateway } from "@/lib/gateway";
import { formatOrderNumber } from "@/lib/orderNumber";
import { LARGE_FILE_USER_HINT } from "@/lib/delivery";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const FOREIGN_KEY_VIOLATION = "P2003";

// ثبت سفارش یک مسیر حساس مالی است: حداکثر ۱۰ تلاش در دقیقه برای هر کاربر.
const ORDER_RATE_LIMIT = 10;
const ORDER_RATE_WINDOW_MS = 60_000;

/** کلید یکتای رکورد Payment سفارش؛ جدا از کلید سفارش تا با تراکنش کیف پول تداخل نکند. */
function paymentIdempotencyKey(orderIdempotencyKey: string): string {
  return `order-pay:${orderIdempotencyKey}`;
}

// GET /api/orders
// لیست سفارش‌های کاربر جاری (فقط سفارش‌های خودش) به‌همراه اطلاعات دانلود در صورت آماده بودن.
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای مشاهده‌ی سفارش‌ها باید وارد شوید." }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { delivery: true } } },
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: formatOrderNumber(order.orderNumber),
      items: order.items.map((item) => {
        const isDeliverable = item.status === "ready" || item.status === "delivered";
        const delivery = item.delivery;

        let downloadUrl: string | null = null;
        let supportMessage: string | null = null;

        if (isDeliverable && delivery) {
          if (delivery.isLarge) {
            supportMessage = LARGE_FILE_USER_HINT;
          } else if (delivery.storageKey) {
            downloadUrl = `/api/orders/items/${item.id}/download`;
          } else if (delivery.fileUrl) {
            downloadUrl = delivery.fileUrl;
          }
        }

        return {
          id: item.id,
          category: item.category,
          sourceSite: item.sourceSite,
          productUrl: item.productUrl,
          status: item.status,
          downloadUrl,
          supportMessage,
        };
      }),
      priceRial: order.totalPriceRial.toString(),
      priceLabel: rialToTomanLabel(Number(order.totalPriceRial)),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
  });
}

// POST /api/orders
// ثبت سفارش با دو روش پرداخت:
//   - wallet:  کسر اتمیک از کیف پول و رفتن مستقیم به صف (draft → awaiting_payment → queued).
//   - gateway: ساخت سفارش در awaiting_payment و هدایت کاربر به درگاه؛ صف‌شدن فقط بعد از
//              تأیید پرداخت در callback اتفاق می‌افتد (lib/payment.ts → confirmOrderPayment).
// قیمت در هر دو حالت فقط سمت سرور و بر اساس کارمزد همان روش پرداخت محاسبه می‌شود.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای ثبت سفارش باید وارد شوید." }, { status: 401 });
  }

  // کلید محدودیت از session ساخته می‌شود، نه از ورودی کلاینت.
  const limit = checkRateLimit(`orders:${currentUser.id}`, ORDER_RATE_LIMIT, ORDER_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(createOrderInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const userId = currentUser.id;
  const { categoryId, site, productUrl, paymentMethod, idempotencyKey } = input;

  // درخواست تکراری: همان سفارش قبلی برگردانده می‌شود، سفارش/کسر/پرداخت جدید ساخته نمی‌شود.
  const existingOrder = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (existingOrder) {
    if (existingOrder.userId !== userId) {
      return NextResponse.json({ error: "کلید یکتای درخواست نامعتبر است." }, { status: 409 });
    }
    return buildResponse(existingOrder, idempotencyKey);
  }

  const price = await computePriceForPaymentMethod(categoryId, site, paymentMethod);
  if (!price) {
    return NextResponse.json({ error: "دسته یا سایت نامعتبر" }, { status: 422 });
  }

  const actor = `user:${userId}`;
  const priceRial = BigInt(price.payablePriceRial);

  // برای پرداخت درگاهی، تلاش پرداخت پیش از تراکنش ساخته می‌شود (همان ترتیب مسیر شارژ کیف پول).
  let gatewayAttempt: { authority: string; redirectUrl: string } | null = null;
  if (paymentMethod === "gateway") {
    const callbackUrl = new URL("/api/orders/payment/callback", req.url).toString();
    const gateway = await getGateway();
    gatewayAttempt = await gateway.requestPayment(priceRial, callbackUrl);
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
          totalPriceRial: priceRial,
          paymentMethod,
          status: "draft",
          idempotencyKey,
          items: {
            create: {
              sourceSite: price.site,
              category: categoryId,
              productUrl,
              priceRial: BigInt(price.finalPriceRial),
            },
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
          priceRial,
          order.id,
          `پرداخت سفارش ${formatOrderNumber(order.orderNumber)}`,
          idempotencyKey,
        );
        await transitionOrder(tx, order.id, "awaiting_payment", "queued", "system");
        await accrueOrderCommissionInTx(tx, order.id);
        return;
      }

      // pending: سفارش در awaiting_payment می‌ماند تا callback درگاه آن را تأیید کند.
      await tx.payment.create({
        data: {
          userId,
          orderId: order.id,
          amountRial: priceRial,
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
      items: [{ productUrl }],
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
