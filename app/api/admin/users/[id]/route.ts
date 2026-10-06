import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { parsePageParams, paginatedResult } from "@/lib/pagination";
import { categoryTitle } from "@/data/categories";

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
    include: {
      wallet: true,
      referredBy: { select: { id: true, mobile: true, referralCode: true } },
    },
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
      include: { items: { orderBy: { position: "asc" } } },
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
      disabledAt: user.disabledAt?.toISOString() ?? null,
      disabledReason: user.disabledReason,
      walletBalanceRial: (user.wallet?.balanceRial ?? 0n).toString(),
      // همکاری در فروش: معرفِ این کاربر، و اگر خودش همکار است لینک به صفحه‌ی همکاری‌اش.
      referrer: user.referredBy,
      isAffiliate: !!user.affiliateJoinedAt,
    },
    orders: paginatedResult(
      orders.map((o) => ({
        id: o.id,
        categoryTitle: o.items[0] ? categoryTitle(o.items[0].category) : null,
        sourceSite: o.items[0]?.sourceSite ?? null,
        priceLabel: rialToTomanLabel(Number(o.totalPriceRial)),
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

// DELETE /api/admin/users/:id
// حذف دائمی کاربر از دیتابیس؛ فقط admin. کاربری که سفارش، پرداخت یا تراکنش کیف پول دارد حذف نمی‌شود
// (دفتر مالی append-only است و حذفش حسابداری را می‌شکند)؛ برای او باید «غیرفعال‌سازی» را زد.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  if (admin.id === params.id) {
    return NextResponse.json({ error: "نمی‌توانید حساب خودتان را حذف کنید." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { wallet: { select: { id: true, balanceRial: true } } },
  });
  if (!target) {
    return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
  }
  if (target.role !== "user") {
    return NextResponse.json({ error: "ابتدا نقش این کاربر را به «کاربر عادی» برگردانید، بعد حذفش کنید." }, { status: 400 });
  }

  const [orders, payments, walletTx, referrals, hasAffiliate] = await Promise.all([
    prisma.order.count({ where: { userId: target.id } }),
    prisma.payment.count({ where: { userId: target.id } }),
    target.wallet ? prisma.walletTransaction.count({ where: { walletId: target.wallet.id } }) : Promise.resolve(0),
    prisma.user.count({ where: { referredById: target.id } }),
    prisma.affiliateAccount.count({ where: { userId: target.id } }),
  ]);
  if (orders + payments + walletTx + referrals + hasAffiliate > 0) {
    return NextResponse.json(
      {
        error:
          "این کاربر سفارش، پرداخت، تراکنش کیف پول یا سابقه‌ی همکاری دارد و حذف دائمی آن دفتر مالی را خراب می‌کند. به‌جای حذف، «غیرفعال‌سازی» را بزنید.",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.passwordReset.deleteMany({ where: { userId: target.id } });
      await tx.notification.deleteMany({ where: { userId: target.id } });
      await tx.supportMessage.deleteMany({ where: { userId: target.id } });
      await tx.cartItem.deleteMany({ where: { cart: { userId: target.id } } });
      await tx.cart.deleteMany({ where: { userId: target.id } });
      await tx.wallet.deleteMany({ where: { userId: target.id } });
      await tx.otpCode.deleteMany({ where: { mobile: target.mobile } });
      await tx.user.delete({ where: { id: target.id } });
    });
  } catch (error) {
    // کلید خارجی دیگری (مثلاً سابقه‌ی لاگ) هنوز به کاربر اشاره می‌کند.
    if ((error as { code?: string }).code === "P2003") {
      return NextResponse.json(
        { error: "این کاربر هنوز در سوابق دیگری استفاده شده؛ به‌جای حذف، غیرفعالش کنید." },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
