import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computePrice } from "@/lib/pricing";
import { rialToTomanLabel } from "@/lib/money";
import { validateInput, createOrderInput, ValidationError } from "@/lib/validation";
import { debitWalletInTx, WalletError } from "@/lib/wallet";
import { assertTransition, type OrderStatus } from "@/lib/orderState";
import { getCurrentUser } from "@/lib/session";

const FOREIGN_KEY_VIOLATION = "P2003";

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
    include: { delivery: true },
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      category: order.category,
      sourceSite: order.sourceSite,
      productUrl: order.productUrl,
      priceRial: order.priceRial.toString(),
      priceLabel: rialToTomanLabel(Number(order.priceRial)),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      downloadUrl:
        (order.status === "ready" || order.status === "delivered") && order.delivery
          ? order.delivery.fileUrl
          : null,
    })),
  });
}

// POST /api/orders
// ثبت سفارش: اعتبارسنجی ورودی، محاسبه‌ی قیمت فقط سمت سرور، و انتقال اتمیک
// سفارش از draft تا queued (شامل کسر کیف پول و ثبت رویدادها).
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای ثبت سفارش باید وارد شوید." }, { status: 401 });
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

  // درخواست تکراری: همان سفارش قبلی برگردانده می‌شود، سفارش/کسر جدید ساخته نمی‌شود.
  const existingOrder = await prisma.order.findUnique({ where: { idempotencyKey } });
  if (existingOrder) {
    return buildResponse(existingOrder, idempotencyKey);
  }

  const price = computePrice(categoryId, site);
  if (!price) {
    return NextResponse.json({ error: "دسته یا سایت نامعتبر" }, { status: 422 });
  }

  const actor = `user:${userId}`;
  const priceRial = BigInt(price.finalPriceRial);

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
          sourceSite: site,
          category: categoryId,
          productUrl,
          priceRial,
          status: "draft",
          idempotencyKey,
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
          `پرداخت سفارش ${order.id}`,
          idempotencyKey,
        );
      }

      await transitionOrder(tx, order.id, "awaiting_payment", "queued", "system");
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
  order: { id: string; status: string; priceRial: bigint },
  idempotencyKey: string,
) {
  const walletTransaction = await prisma.walletTransaction.findUnique({ where: { idempotencyKey } });
  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    priceRial: order.priceRial.toString(),
    priceLabel: rialToTomanLabel(Number(order.priceRial)),
    walletBalanceRial: walletTransaction ? walletTransaction.balanceAfter.toString() : null,
  });
}
