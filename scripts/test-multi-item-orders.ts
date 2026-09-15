// تست مدل و منطق پایه‌ی سفارش چندآیتمی + سبد خرید (بدون UI/پرداخت/پنل).
// بررسی می‌کند: ساخت سفارش چندآیتمی، محاسبه‌ی قیمت کل سبد با کارمزد دو روش پرداخت،
// و منطق مشتق‌شدن وضعیت کلی سفارش از وضعیت آیتم‌ها (lib/orderState.ts).
// نیازمند دیتابیس در دسترس (DATABASE_URL) اما نه سرور dev.

import { prisma } from "../lib/db";
import { computeCartTotal, computePrice } from "../lib/pricing";
import { deriveOrderStatusFromItems, type OrderItemStatus } from "../lib/orderState";
import { addCartItem, getCartItems, removeCartItem, clearCart, getOrCreateCart } from "../lib/cart";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`✅ ${label}`);
  } else {
    failed++;
    console.log(`❌ ${label}${detail ? " — " + detail : ""}`);
  }
}

async function main() {
  const mobile = "0939" + Math.floor(1000000 + Math.random() * 8999999);
  const user = await prisma.user.create({
    data: { mobile, wallet: { create: { balanceRial: 0n } } },
  });
  console.log("کاربر تست:", user.id);

  // ── ۱) ساخت سفارش چندآیتمی مستقیم در دیتابیس ──
  const item1Price = computePrice("vector", "Freepik")!;
  const item2Price = computePrice("icon", "Flaticon")!;
  const item3Price = computePrice("photo", "Shutterstock")!;

  const subtotal = item1Price.finalPriceRial + item2Price.finalPriceRial + item3Price.finalPriceRial;

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      totalPriceRial: BigInt(subtotal), // placeholder؛ بعد از محاسبه‌ی واقعی به‌روز می‌شود
      paymentMethod: "wallet",
      status: "queued",
      items: {
        create: [
          { sourceSite: "Freepik", category: "vector", productUrl: "https://freepik.com/x1", priceRial: BigInt(item1Price.finalPriceRial) },
          { sourceSite: "Flaticon", category: "icon", productUrl: "https://flaticon.com/x2", priceRial: BigInt(item2Price.finalPriceRial) },
          { sourceSite: "Shutterstock", category: "photo", productUrl: "https://shutterstock.com/x3", priceRial: BigInt(item3Price.finalPriceRial) },
        ],
      },
    },
    include: { items: true },
  });

  check("سفارش دارای ۳ آیتم است", order.items.length === 3, String(order.items.length));

  // ── ۲) محاسبه‌ی قیمت کل سبد با کارمزد هر دو روش پرداخت ──
  const cartInput = [
    { categoryId: "vector", site: "Freepik" },
    { categoryId: "icon", site: "Flaticon" },
    { categoryId: "photo", site: "Shutterstock" },
  ];

  const walletTotal = await computeCartTotal(cartInput, "wallet");
  const gatewayTotal = await computeCartTotal(cartInput, "gateway");

  check("subtotal سبد با مجموع دستی برابر است", walletTotal?.subtotalRial === subtotal, `${walletTotal?.subtotalRial} vs ${subtotal}`);
  check(
    "قیمت نهایی کیف‌پول شامل کارمزد ۵٪ است",
    walletTotal?.payableTotalRial === Math.round(subtotal * 1.05),
    `${walletTotal?.payableTotalRial} vs ${Math.round(subtotal * 1.05)}`,
  );
  check(
    "قیمت نهایی درگاه شامل کارمزد ۱۱٪ است",
    gatewayTotal?.payableTotalRial === Math.round(subtotal * 1.11),
    `${gatewayTotal?.payableTotalRial} vs ${Math.round(subtotal * 1.11)}`,
  );

  const invalidCart = await computeCartTotal([{ categoryId: "vector", site: "NotASite" }], "wallet");
  check("دسته/سایت نامعتبر → null", invalidCart === null);

  await prisma.order.update({ where: { id: order.id }, data: { totalPriceRial: BigInt(walletTotal!.payableTotalRial) } });

  // ── ۳) منطق مشتق‌شدن وضعیت سفارش از وضعیت آیتم‌ها ──
  const cases: { statuses: OrderItemStatus[]; expected: "processing" | "ready" | "delivered" }[] = [
    { statuses: ["pending", "pending", "pending"], expected: "processing" },
    { statuses: ["pending", "ready", "pending"], expected: "ready" },
    { statuses: ["ready", "ready", "ready"], expected: "ready" },
    { statuses: ["delivered", "ready", "pending"], expected: "ready" },
    { statuses: ["delivered", "delivered", "delivered"], expected: "delivered" },
  ];
  for (const c of cases) {
    const result = deriveOrderStatusFromItems(c.statuses);
    check(`derive(${c.statuses.join(",")}) === ${c.expected}`, result === c.expected, result);
  }

  let threwOnEmpty = false;
  try {
    deriveOrderStatusFromItems([]);
  } catch {
    threwOnEmpty = true;
  }
  check("سفارش بدون آیتم → خطا", threwOnEmpty);

  // اعمال واقعی روی آیتم‌های سفارش ساخته‌شده و بررسی سازگاری با state machine سفارش
  await prisma.orderItem.update({ where: { id: order.items[0].id }, data: { status: "ready" } });
  await prisma.orderItem.update({ where: { id: order.items[1].id }, data: { status: "pending" } });
  await prisma.orderItem.update({ where: { id: order.items[2].id }, data: { status: "pending" } });
  let refreshed = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  check(
    "بعد از آماده‌شدن یک آیتم، وضعیت مشتق‌شده ready است",
    deriveOrderStatusFromItems(refreshed.map((i) => i.status as OrderItemStatus)) === "ready",
  );

  await prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { status: "delivered" } });
  refreshed = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  check(
    "بعد از تحویل همه‌ی آیتم‌ها، وضعیت مشتق‌شده delivered است",
    deriveOrderStatusFromItems(refreshed.map((i) => i.status as OrderItemStatus)) === "delivered",
  );

  // ── ۴) سبد خرید ──
  await clearCart(user.id);
  const cart = await getOrCreateCart(user.id);
  check("سبد جدید برای کاربر ساخته شد", cart.userId === user.id);

  const ci1 = await addCartItem(user.id, { categoryId: "vector", site: "Freepik", productUrl: "https://freepik.com/c1" });
  await addCartItem(user.id, { categoryId: "icon", site: "Flaticon", productUrl: "https://flaticon.com/c2" });

  let cartItems = await getCartItems(user.id);
  check("۲ آیتم در سبد است", cartItems.length === 2, String(cartItems.length));
  check("قیمت آیتم سبد با computePrice برابر است", cartItems[0].priceRial === BigInt(item1Price.finalPriceRial));

  await removeCartItem(user.id, ci1.id);
  cartItems = await getCartItems(user.id);
  check("بعد از حذف، ۱ آیتم باقی مانده", cartItems.length === 1, String(cartItems.length));

  let removeOtherUsersItemFailed = false;
  const otherUser = await prisma.user.create({ data: { mobile: "0930" + Math.floor(1000000 + Math.random() * 8999999) } });
  try {
    await removeCartItem(otherUser.id, cartItems[0].id);
  } catch {
    removeOtherUsersItemFailed = true;
  }
  check("کاربر دیگر نمی‌تواند آیتم سبد این کاربر را حذف کند", removeOtherUsersItemFailed);

  let invalidAddFailed = false;
  try {
    await addCartItem(user.id, { categoryId: "vector", site: "NotASite", productUrl: "https://x.com" });
  } catch {
    invalidAddFailed = true;
  }
  check("افزودن آیتم با سایت نامعتبر رد می‌شود", invalidAddFailed);

  await clearCart(user.id);
  cartItems = await getCartItems(user.id);
  check("بعد از clearCart سبد خالی است", cartItems.length === 0);

  console.log(`\n────────────\nموفق: ${passed}   ناموفق: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
