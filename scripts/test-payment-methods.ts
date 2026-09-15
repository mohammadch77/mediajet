// تست جریان دو روش پرداخت (کیف پول با کارمزد ۵٪ و درگاه با کارمزد ۱۱٪).
// اجرا: سرور dev بالا باشد، سپس  npx tsx scripts/test-payment-methods.ts

import crypto from "crypto";
import { prisma } from "../lib/db";
import { creditWallet } from "../lib/wallet";
import { computePrice } from "../lib/pricing";
import { setPaymentSetting } from "../lib/paymentSettings";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail: string = ""): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function loginAs(mobile: string, role: "user" | "admin"): Promise<{ userId: string; token: string }> {
  const user = await prisma.user.upsert({
    where: { mobile },
    update: { role },
    create: { mobile, role, wallet: { create: { balanceRial: 0n } } },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 86400000) },
  });

  return { userId: user.id, token };
}

function cookie(token: string) {
  return { Cookie: `mediajet_session=${token}` };
}

async function postJson(path: string, token: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cookie(token) },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function getQuote(categoryId: string, site: string) {
  const res = await fetch(`${BASE_URL}/api/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, site }),
  });
  return res.json();
}

async function callCallback(redirectUrl: string, status: "OK" | "NOK") {
  // صفحه‌ی درگاه آزمایشی، authority و callback را در query دارد.
  const mock = new URL(redirectUrl, BASE_URL);
  const authority = mock.searchParams.get("authority")!;
  const callback = mock.searchParams.get("callback")!;
  const target = new URL(callback);
  target.searchParams.set("Authority", authority);
  target.searchParams.set("Status", status);
  await fetch(target.toString(), { redirect: "manual" });
  return authority;
}

const CATEGORY = "vector";
const SITE = "Freepik";

async function main() {
  // مقادیر پیش‌فرض را صریح ست می‌کنیم تا تست به وضعیت قبلی دیتابیس وابسته نباشد.
  const admin = await loginAs("09120000001", "admin");
  await setPaymentSetting("payment.gateway_surcharge_percent", 11, admin.userId);
  await setPaymentSetting("payment.wallet_surcharge_percent", 5, admin.userId);
  await setPaymentSetting("payment.wallet_min_charge_rial", 1_000_000, admin.userId);

  const base = computePrice(CATEGORY, SITE)!;
  const expectedWallet = Math.round(base.finalPriceRial * 1.05);
  const expectedGateway = Math.round(base.finalPriceRial * 1.11);

  const user = await loginAs("0913000" + Math.floor(Math.random() * 100000), "user");
  await creditWallet(user.userId, 50_000_000n, "seed", "شارژ تست", "test-pm-" + user.userId);

  console.log(`قیمت پایه (${CATEGORY}/${SITE}):`, base.finalPriceRial, "ریال\n");

  // ── ۱) /api/quote هر دو قیمت را با کارمزد درست برمی‌گرداند و درصدی لو نمی‌دهد ──
  console.log("[۱] قیمت‌گیری هر دو روش");
  const quote = await getQuote(CATEGORY, SITE);
  check(
    "قیمت کیف پول = پایه + ۵٪",
    Number(quote.walletPriceRial) === expectedWallet,
    `${quote.walletPriceRial} (انتظار ${expectedWallet})`,
  );
  check(
    "قیمت درگاه = پایه + ۱۱٪",
    Number(quote.gatewayPriceRial) === expectedGateway,
    `${quote.gatewayPriceRial} (انتظار ${expectedGateway})`,
  );
  check(
    "هیچ درصدی در پاسخ نیست",
    !JSON.stringify(quote).includes("ercent") && quote.multiplier === undefined,
    JSON.stringify(quote),
  );

  // ── ۲) پرداخت از کیف پول: قیمت با کارمزد ۵٪ کسر می‌شود ──
  console.log("\n[۲] سفارش با پرداخت از کیف پول");
  const walletKey = "test-pm-wallet-" + crypto.randomUUID();
  const balanceBefore = (await prisma.wallet.findUnique({ where: { userId: user.userId } }))!.balanceRial;
  const walletOrder = await postJson("/api/orders", user.token, {
    categoryId: CATEGORY,
    site: SITE,
    productUrl: "https://freepik.com/test-wallet",
    paymentMethod: "wallet",
    idempotencyKey: walletKey,
  });
  const wOrder = await prisma.order.findUnique({ where: { idempotencyKey: walletKey } });
  const balanceAfter = (await prisma.wallet.findUnique({ where: { userId: user.userId } }))!.balanceRial;

  check("پاسخ ۲۰۰", walletOrder.status === 200, JSON.stringify(walletOrder.json));
  check(
    "قیمت ثبت‌شده شامل کارمزد ۵٪ است",
    wOrder?.totalPriceRial === BigInt(expectedWallet),
    `${wOrder?.totalPriceRial} (انتظار ${expectedWallet})`,
  );
  check("سفارش مستقیم به صف رفت", wOrder?.status === "queued", String(wOrder?.status));
  check(
    "همان مبلغ از کیف پول کسر شد",
    balanceBefore - balanceAfter === BigInt(expectedWallet),
    `${balanceBefore - balanceAfter}`,
  );

  // ── ۳) پرداخت درگاهی موفق: قیمت با کارمزد ۱۱٪ و صف‌شدن فقط بعد از callback ──
  console.log("\n[۳] سفارش با پرداخت مستقیم از درگاه (موفق)");
  const gwKey = "test-pm-gw-" + crypto.randomUUID();
  const gwOrder = await postJson("/api/orders", user.token, {
    categoryId: CATEGORY,
    site: SITE,
    productUrl: "https://freepik.com/test-gateway",
    paymentMethod: "gateway",
    idempotencyKey: gwKey,
  });
  const gOrderBefore = await prisma.order.findUnique({ where: { idempotencyKey: gwKey } });

  check(
    "پاسخ ۲۰۰ و redirectUrl دارد",
    gwOrder.status === 200 && !!gwOrder.json.redirectUrl,
    `${gwOrder.status} ${JSON.stringify(gwOrder.json)}`,
  );
  if (!gwOrder.json.redirectUrl) {
    console.log("\nادامه‌ی تست ممکن نیست: پرداخت درگاهی ساخته نشد.");
    console.log(`\n────────────\nموفق: ${passed}   ناموفق: ${failed}`);
    process.exitCode = 1;
    return;
  }
  check(
    "قیمت ثبت‌شده شامل کارمزد ۱۱٪ است",
    gOrderBefore?.totalPriceRial === BigInt(expectedGateway),
    `${gOrderBefore?.totalPriceRial} (انتظار ${expectedGateway})`,
  );
  check(
    "پیش از پرداخت در awaiting_payment است (به صف نرفته)",
    gOrderBefore?.status === "awaiting_payment",
    String(gOrderBefore?.status),
  );

  const gwAuthority = await callCallback(gwOrder.json.redirectUrl, "OK");
  const gOrderAfter = await prisma.order.findUnique({
    where: { idempotencyKey: gwKey },
    include: { events: true },
  });
  check("بعد از تأیید پرداخت به صف رفت", gOrderAfter?.status === "queued", String(gOrderAfter?.status));
  check(
    "دقیقاً یک رویداد queued ثبت شد",
    gOrderAfter!.events.filter((e) => e.toStatus === "queued").length === 1,
  );
  check(
    "کیف پول برای پرداخت درگاهی دست نخورد",
    (await prisma.wallet.findUnique({ where: { userId: user.userId } }))!.balanceRial === balanceAfter,
  );

  // ── ۴) idempotency: تکرار همان callback نباید دوباره صف کند یا دوباره وجه بگیرد ──
  console.log("\n[۴] تکرار callback پرداخت (idempotency)");
  await callCallback(gwOrder.json.redirectUrl, "OK");
  await callCallback(gwOrder.json.redirectUrl, "OK");
  const gOrderReplay = await prisma.order.findUnique({
    where: { idempotencyKey: gwKey },
    include: { events: true },
  });
  const paymentsForOrder = await prisma.payment.count({ where: { orderId: gOrderAfter!.id } });

  check("وضعیت همچنان queued است", gOrderReplay?.status === "queued", String(gOrderReplay?.status));
  check(
    "هنوز فقط یک رویداد queued وجود دارد",
    gOrderReplay!.events.filter((e) => e.toStatus === "queued").length === 1,
    `تعداد: ${gOrderReplay!.events.filter((e) => e.toStatus === "queued").length}`,
  );
  check("فقط یک رکورد Payment برای این سفارش هست", paymentsForOrder === 1, `تعداد: ${paymentsForOrder}`);
  check(
    "وضعیت Payment همچنان verified است",
    (await prisma.payment.findUnique({ where: { authority: gwAuthority } }))!.status === "verified",
  );

  // ── ۵) پرداخت ناموفق: سفارش نباید به صف برود ──
  console.log("\n[۵] پرداخت درگاهی ناموفق");
  const failKey = "test-pm-fail-" + crypto.randomUUID();
  const failOrder = await postJson("/api/orders", user.token, {
    categoryId: CATEGORY,
    site: SITE,
    productUrl: "https://freepik.com/test-failed",
    paymentMethod: "gateway",
    idempotencyKey: failKey,
  });
  const failAuthority = await callCallback(failOrder.json.redirectUrl, "NOK");
  const fOrder = await prisma.order.findUnique({
    where: { idempotencyKey: failKey },
    include: { events: true },
  });

  check(
    "سفارش به صف نرفت و در awaiting_payment ماند",
    fOrder?.status === "awaiting_payment",
    String(fOrder?.status),
  );
  check("هیچ رویداد queued ثبت نشد", fOrder!.events.every((e) => e.toStatus !== "queued"));
  check(
    "دلیل شکست در audit trail ثبت شد",
    fOrder!.events.some((e) => !!e.note && e.note.includes("لغو")),
    fOrder!.events.map((e) => e.note).filter(Boolean).join(" | "),
  );
  check(
    "وضعیت Payment برابر failed است",
    (await prisma.payment.findUnique({ where: { authority: failAuthority } }))!.status === "failed",
  );

  // تکرار callback ناموفق هم نباید چیزی را عوض کند
  await callCallback(failOrder.json.redirectUrl, "OK");
  const fOrderReplay = await prisma.order.findUnique({ where: { idempotencyKey: failKey } });
  check(
    "callback بعدی نمی‌تواند پرداخت ناموفق را زنده کند",
    fOrderReplay?.status === "awaiting_payment",
    String(fOrderReplay?.status),
  );

  // ── ۶) تغییر تنظیمات ادمین بلافاصله روی قیمت بعدی اثر می‌گذارد (بدون کش) ──
  console.log("\n[۶] اثر تغییر تنظیمات ادمین روی قیمت");
  const adminRes = await postJson("/api/admin/payment-settings", admin.token, {
    fields: [
      { key: "payment.gateway_surcharge_percent", value: 20 },
      { key: "payment.wallet_surcharge_percent", value: 7 },
    ],
  });
  check("ذخیره‌ی تنظیمات توسط ادمین موفق بود", adminRes.status === 200, JSON.stringify(adminRes.json));

  const quote2 = await getQuote(CATEGORY, SITE);
  check(
    "قیمت کیف پول با درصد جدید (۷٪) محاسبه شد",
    Number(quote2.walletPriceRial) === Math.round(base.finalPriceRial * 1.07),
    `${quote2.walletPriceRial} (انتظار ${Math.round(base.finalPriceRial * 1.07)})`,
  );
  check(
    "قیمت درگاه با درصد جدید (۲۰٪) محاسبه شد",
    Number(quote2.gatewayPriceRial) === Math.round(base.finalPriceRial * 1.2),
    `${quote2.gatewayPriceRial} (انتظار ${Math.round(base.finalPriceRial * 1.2)})`,
  );

  const badRes = await postJson("/api/admin/payment-settings", admin.token, {
    fields: [{ key: "payment.gateway_surcharge_percent", value: 150 }],
  });
  check("درصد خارج از بازه رد شد", badRes.status === 400, JSON.stringify(badRes.json));

  const forbidden = await postJson("/api/admin/payment-settings", user.token, {
    fields: [{ key: "payment.gateway_surcharge_percent", value: 0 }],
  });
  check("کاربر عادی به تنظیمات پرداخت دسترسی ندارد", forbidden.status === 403);

  // بازگرداندن مقادیر پیش‌فرض
  await setPaymentSetting("payment.gateway_surcharge_percent", 11, admin.userId);
  await setPaymentSetting("payment.wallet_surcharge_percent", 5, admin.userId);

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
