import { prisma } from "../lib/db";
import { creditWallet } from "../lib/wallet";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

async function postOrder(body: unknown) {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  const mobile = "0901000" + Math.floor(Math.random() * 10000);
  const user = await prisma.user.create({
    data: { mobile, name: "کاربر تست سفارش", wallet: { create: { balanceRial: 0n } } },
  });
  console.log("کاربر ساخته شد:", user.id);

  await creditWallet(user.id, 2000000n, "seed", "شارژ اولیه", "test-orders-credit-" + user.id);
  console.log("کیف پول شارژ شد: 2,000,000 ریال");

  // سناریو ۱: سفارش موفق با موجودی کافی
  const key1 = "test-order-" + user.id + "-ok";
  const r1 = await postOrder({
    userId: user.id,
    categoryId: "vector",
    site: "Freepik",
    productUrl: "https://freepik.com/some-vector",
    paymentMethod: "wallet",
    idempotencyKey: key1,
  });
  console.log("\n[سناریو ۱] سفارش موفق:", r1.status, r1.json);

  const order1 = await prisma.order.findUnique({ where: { idempotencyKey: key1 }, include: { events: true } });
  const wallet1 = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log("  وضعیت سفارش:", order1?.status, "(انتظار: queued)");
  console.log("  موجودی کیف پول:", wallet1?.balanceRial.toString(), "(انتظار: 1300000، چون وکتور از فریپیک = 700000)");
  console.log("  تعداد رویدادهای سفارش:", order1?.events.length, "(انتظار: 3 → draft, awaiting_payment, queued)");

  // سناریو ۲: سفارش با موجودی ناکافی
  const key2 = "test-order-" + user.id + "-insufficient";
  const beforeCount = await prisma.order.count();
  const beforeBalance = (await prisma.wallet.findUnique({ where: { userId: user.id } }))!.balanceRial;
  const r2 = await postOrder({
    userId: user.id,
    categoryId: "video",
    site: "Envato",
    productUrl: "https://envato.com/some-video",
    paymentMethod: "wallet",
    idempotencyKey: key2,
  });
  console.log("\n[سناریو ۲] موجودی ناکافی:", r2.status, r2.json);

  const afterCount = await prisma.order.count();
  const afterBalance = (await prisma.wallet.findUnique({ where: { userId: user.id } }))!.balanceRial;
  const failedOrder = await prisma.order.findUnique({ where: { idempotencyKey: key2 } });
  console.log("  سفارشی ساخته نشد:", failedOrder === null, "| تعداد کل سفارش‌ها قبل/بعد:", beforeCount, afterCount);
  console.log("  موجودی دست‌نخورده:", beforeBalance === afterBalance, `(${beforeBalance} -> ${afterBalance})`);

  // سناریو ۳: idempotency — همان درخواست دوبار
  const key3 = "test-order-" + user.id + "-idem";
  const r3a = await postOrder({
    userId: user.id,
    categoryId: "icon",
    site: "Flaticon",
    productUrl: "https://flaticon.com/some-icon",
    paymentMethod: "wallet",
    idempotencyKey: key3,
  });
  const r3b = await postOrder({
    userId: user.id,
    categoryId: "icon",
    site: "Flaticon",
    productUrl: "https://flaticon.com/some-icon",
    paymentMethod: "wallet",
    idempotencyKey: key3,
  });
  console.log("\n[سناریو ۳] idempotency:");
  console.log("  درخواست اول:", r3a.status, r3a.json);
  console.log("  درخواست دوم:", r3b.status, r3b.json);
  console.log("  orderId یکسان:", r3a.json.orderId === r3b.json.orderId);

  const ordersWithKey3 = await prisma.order.count({ where: { idempotencyKey: key3 } });
  const walletTxWithKey3 = await prisma.walletTransaction.count({ where: { idempotencyKey: key3 } });
  console.log("  تعداد سفارش با این کلید:", ordersWithKey3, "(انتظار: 1)");
  console.log("  تعداد تراکنش کیف پول با این کلید:", walletTxWithKey3, "(انتظار: 1)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
