// تست ثبت سفارش تکی با کیف پول از مسیر HTTP واقعی، با هویت از session (کوکی)، نه userId در بدنه.
// اجرا: سرور dev بالا باشد، سپس  npx tsx scripts/test-orders.ts

import crypto from "crypto";
import { prisma } from "../lib/db";
import { creditWallet } from "../lib/wallet";
import { computePriceForPaymentMethod } from "../lib/pricing";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) passed++; else failed++;
  console.log(`  ${condition ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function postOrder(cookie: string, body: unknown) {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function main() {
  const mobile = "0901" + Math.floor(1000000 + Math.random() * 8999999);
  const user = await prisma.user.create({
    data: { mobile, name: "کاربر تست سفارش", wallet: { create: { balanceRial: 0n } } },
  });
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const cookie = `mediajet_session=${token}`;
  await creditWallet(user.id, 2_000_000n, "seed", "شارژ اولیه", "test-orders-credit-" + user.id);

  const walletOf = async () => (await prisma.wallet.findUnique({ where: { userId: user.id } }))!.balanceRial;

  console.log("\n[۱] سفارش موفق با موجودی کافی (وکتور / Freepik)");
  const expected = (await computePriceForPaymentMethod("vector", "Freepik (Magnific)", "wallet"))!;
  const key1 = "test-order-" + user.id + "-ok";
  const r1 = await postOrder(cookie, {
    categoryId: "vector",
    site: "Freepik (Magnific)",
    productUrl: "https://www.freepik.com/some-vector",
    paymentMethod: "wallet",
    idempotencyKey: key1,
  });
  const order1 = await prisma.order.findUnique({ where: { idempotencyKey: key1 }, include: { events: true } });
  check("پاسخ موفق", r1.status === 200, `status=${r1.status}`);
  check("سفارش به صف رفت", order1?.status === "queued", String(order1?.status));
  check("مبلغ سفارش = قیمت سرور با کارمزد کیف پول", order1?.totalPriceRial === BigInt(expected.payablePriceRial), `${order1?.totalPriceRial}`);
  check("همین مبلغ از کیف پول کم شد", (await walletOf()) === 2_000_000n - BigInt(expected.payablePriceRial));
  check("۳ رویداد audit ثبت شد (draft, awaiting_payment, queued)", order1?.events.map((e) => e.toStatus).sort().join(",") === "awaiting_payment,draft,queued");

  console.log("\n[۲] سفارش با موجودی ناکافی (ویدیو / Shutterstock)");
  const key2 = "test-order-" + user.id + "-insufficient";
  const beforeBalance = await walletOf();
  const r2 = await postOrder(cookie, {
    categoryId: "video",
    site: "Shutterstock",
    productUrl: "https://www.shutterstock.com/some-video",
    paymentMethod: "wallet",
    idempotencyKey: key2,
  });
  check("خطای موجودی ناکافی (۴۲۲)", r2.status === 422, r2.json?.error);
  check("سفارشی ساخته نشد", (await prisma.order.findUnique({ where: { idempotencyKey: key2 } })) === null);
  check("موجودی دست‌نخورده ماند", (await walletOf()) === beforeBalance);

  console.log("\n[۳] idempotency — همان درخواست دوبار");
  const key3 = "test-order-" + user.id + "-idem";
  const body3 = {
    categoryId: "icon",
    site: "Flaticon",
    productUrl: "https://www.flaticon.com/some-icon",
    paymentMethod: "wallet",
    idempotencyKey: key3,
  };
  const r3a = await postOrder(cookie, body3);
  const r3b = await postOrder(cookie, body3);
  check("هر دو پاسخ موفق", r3a.status === 200 && r3b.status === 200);
  check("یک سفارش با این کلید", (await prisma.order.count({ where: { idempotencyKey: key3 } })) === 1);
  check("یک تراکنش کیف پول با این کلید", (await prisma.walletTransaction.count({ where: { idempotencyKey: key3 } })) === 1);

  console.log("\n[۴] امنیت: هویت فقط از session");
  const anon = await postOrder("", { ...body3, idempotencyKey: crypto.randomUUID() });
  check("بدون کوکی → ۴۰۱", anon.status === 401);
  const other = await prisma.user.create({ data: { mobile: "0901" + Math.floor(1000000 + Math.random() * 8999999), wallet: { create: { balanceRial: 0n } } } });
  const spoofKey = crypto.randomUUID();
  await postOrder(cookie, { ...body3, userId: other.id, idempotencyKey: spoofKey });
  const spoofed = await prisma.order.findUnique({ where: { idempotencyKey: spoofKey } });
  check("userId داخل بدنه نادیده گرفته می‌شود", spoofed?.userId === user.id);

  console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
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
