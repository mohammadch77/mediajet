// تست end-to-end همکاری در فروش.
// اجرا: سرور dev با TRUST_PROXY=true بالا باشد (برای تست تشخیص تقلب با IP)، سپس
//   npx tsx --env-file=.env scripts/test-affiliate.ts
//
// پوشش: عضویت و کد یکتا، ثبت زیرمجموعه فقط هنگام ساخت کاربر، نبودِ کمیسیون روی شارژ کیف پول،
// کمیسیون روی سفارش کیف پول و درگاه (فقط یک‌بار، مبنای بدون کارمزد)، ثابت ماندن درصد ردیف‌های قبلی،
// تسویه (حداقل مبلغ، کارت نامعتبر، درخواست باز، idempotency، رد و بازگشت، واریز)، دسترسی ادمین،
// و سازگاری دفتر با موجودی.

import crypto from "crypto";
import { prisma } from "../lib/db";
import { creditWallet } from "../lib/wallet";
import { setPaymentSetting } from "../lib/paymentSettings";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) passed++; else failed++;
  console.log(`  ${condition ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const randomMobile = () => "0912" + Math.floor(1000000 + Math.random() * 8999999);

async function sessionFor(mobile: string, role: "user" | "admin" | "operator" = "user"): Promise<{ userId: string; cookie: string }> {
  const user = await prisma.user.upsert({
    where: { mobile },
    update: { role },
    create: { mobile, role, wallet: { create: { balanceRial: 0n } } },
  });
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.session.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 86400000) } });
  return { userId: user.id, cookie: `mediajet_session=${token}` };
}

/** معادل رسیدن پیامک OTP: آخرین کد معتبر این شماره را با همان هش lib/otp.ts می‌گذارد (بدون وابستگی به لاگ سرور). */
async function plantOtp(mobile: string): Promise<string> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.otpCode.updateMany({ where: { mobile, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.otpCode.create({
    data: {
      mobile,
      codeHash: crypto.createHash("sha256").update(`${mobile}:${code}`).digest("hex"),
      expiresAt: new Date(Date.now() + 120_000),
    },
  });
  return code;
}

/** ثبت‌نام/ورود واقعی با OTP، با کوکی دلخواه (مثلاً mj_ref). */
/** ip: با TRUST_PROXY=true روی سرور، به‌عنوان X-Forwarded-For فرستاده می‌شود (برای تست تشخیص تقلب). */
async function otpLogin(mobile: string, extraCookie = "", ip = "127.0.0.1"): Promise<string> {
  const code = await plantOtp(mobile);
  const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: extraCookie, "X-Forwarded-For": ip },
    body: JSON.stringify({ mobile, code }),
  });
  const m = res.headers.get("set-cookie")?.match(/mediajet_session=[^;]+/);
  if (!m) throw new Error(`ورود ${mobile} ناموفق بود: ${res.status}`);
  return m[0];
}

async function api(path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* پاسخ غیر JSON (مثلاً redirect) */ }
  return { status: res.status, json };
}

async function commissions(affiliateId: string) {
  return prisma.affiliateLedger.findMany({
    where: { account: { userId: affiliateId }, type: "commission" },
    orderBy: { createdAt: "asc" },
  });
}

async function balanceOf(affiliateId: string): Promise<bigint> {
  return (await prisma.affiliateAccount.findUnique({ where: { userId: affiliateId } }))?.balanceRial ?? 0n;
}

/** یک شماره کارت ۱۶ رقمی با رقم کنترل Luhn معتبر می‌سازد. */
function luhnCard(prefix15: string): string {
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(prefix15[14 - i]);
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return prefix15 + String((10 - (sum % 10)) % 10);
}

async function main(): Promise<void> {
  // درصد و حداقل تسویه روی پیش‌فرض (۵٪ و ۲۰۰ هزار تومان) شروع می‌شوند.
  await prisma.siteContent.deleteMany({ where: { key: { startsWith: "affiliate." } } });
  // بخش‌های ۱ تا ۱۵ منطق کمیسیون/تسویه را با آزادسازی فوری می‌سنجند؛ دوره‌ی انتظار در بخش ۱۶ جدا تست می‌شود.
  const bootAdmin = await sessionFor(randomMobile(), "admin");
  await setPaymentSetting("affiliate.hold_days", 0, bootAdmin.userId);

  console.log("\n۱) عضویت در برنامه");
  const affiliate = await sessionFor(randomMobile());
  const j1 = await api("/api/affiliate/join", affiliate.cookie, {});
  const j2 = await api("/api/affiliate/join", affiliate.cookie, {});
  const code: string = j1.json?.code;
  check("کد یکتا ساخته شد", /^[A-Z0-9]{7}$/.test(code ?? ""), code);
  check("عضویت دوباره همان کد را برمی‌گرداند", j2.json?.code === code);
  const anon = await api("/api/affiliate/join", "", {});
  check("کاربر مهمان نمی‌تواند عضو شود", anon.status === 401, `status=${anon.status}`);

  console.log("\n۲) ثبت زیرمجموعه");
  const landing = await fetch(`${BASE_URL}/?ref=${code.toLowerCase()}`, { redirect: "manual" });
  const setCookie = landing.headers.get("set-cookie") ?? "";
  check("لینک ?ref= کوکی httpOnly می‌گذارد", setCookie.includes(`mj_ref=${code}`) && /httponly/i.test(setCookie));
  const refCookie = `mj_ref=${code}`;

  const buyerMobile = randomMobile();
  const buyerCookie = await otpLogin(buyerMobile, refCookie);
  const buyer = (await prisma.user.findUnique({ where: { mobile: buyerMobile } }))!;
  check("کاربر جدید با کد معرف، زیرمجموعه شد", buyer.referredById === affiliate.userId);

  const existing = await sessionFor(randomMobile());
  const existingMobile = (await prisma.user.findUnique({ where: { id: existing.userId } }))!.mobile;
  await otpLogin(existingMobile, refCookie);
  const existingAfter = await prisma.user.findUnique({ where: { id: existing.userId } });
  check("کاربر قدیمی با ورود دوباره زیرمجموعه نمی‌شود", existingAfter?.referredById === null);

  const strangerMobile = randomMobile();
  await otpLogin(strangerMobile, "mj_ref=ZZZZZZZ");
  const stranger = await prisma.user.findUnique({ where: { mobile: strangerMobile } });
  check("کد ناموجود نادیده گرفته می‌شود", stranger?.referredById === null);

  const buyerView = await api("/api/affiliate", buyerCookie);
  check("زیرمجموعه (عضو نشده) داشبورد همکاری ندارد", buyerView.json?.dashboard === null && buyerView.json?.loggedIn === true);

  console.log("\n۳) شارژ کیف پول کمیسیون ندارد");
  const charge = await api("/api/wallet/charge", buyerCookie, { amountRial: 50_000_000 });
  const chargePayment = await prisma.payment.findFirst({ where: { userId: buyer.id, orderId: null }, orderBy: { createdAt: "desc" } });
  if (chargePayment) {
    await fetch(`${BASE_URL}/api/wallet/charge/callback?Authority=${chargePayment.authority}&Status=OK`, { redirect: "manual" });
  } else {
    // اگر شکل API شارژ فرق داشت، مستقیم از سرویس کیف پول شارژ می‌کنیم.
    console.log("  (شارژ درگاهی در دسترس نبود:", charge.status, JSON.stringify(charge.json), "— شارژ مستقیم)");
    await creditWallet(buyer.id, 50_000_000n, null, "شارژ تست");
  }
  const buyerWallet = await prisma.wallet.findUnique({ where: { userId: buyer.id } });
  check("کیف پول زیرمجموعه شارژ شد", (buyerWallet?.balanceRial ?? 0n) >= 50_000_000n, String(buyerWallet?.balanceRial));
  check("بعد از شارژ هیچ کمیسیونی ثبت نشد", (await commissions(affiliate.userId)).length === 0);

  console.log("\n۴) کمیسیون سفارش کیف پول (Freepik/وکتور، پایه ۲۰۰٬۰۰۰ ریال، ۵٪)");
  const key1 = crypto.randomUUID();
  const orderBody = { categoryId: "vector", site: "Freepik (Magnific)", productUrl: "https://www.freepik.com/x-1", paymentMethod: "wallet", idempotencyKey: key1 };
  const o1 = await api("/api/orders", buyerCookie, orderBody);
  check("سفارش کیف پول ثبت شد", o1.status === 200 || o1.status === 201, `status=${o1.status}`);
  let list = await commissions(affiliate.userId);
  check("یک کمیسیون ۱۰٬۰۰۰ ریالی ثبت شد (بدون کارمزد کیف پول)", list.length === 1 && list[0].amountRial === 10_000n && list[0].baseRial === 200_000n && list[0].percent === 5, list.map((c) => `${c.amountRial}/${c.baseRial}/${c.percent}`).join(","));
  await api("/api/orders", buyerCookie, orderBody);
  check("درخواست تکراری (همان idempotencyKey) کمیسیون دوم نمی‌سازد", (await commissions(affiliate.userId)).length === 1);

  console.log("\n۵) کمیسیون سفارش درگاهی سبد (۲ آیتم) — فقط بعد از تأیید پرداخت");
  await api("/api/cart", buyerCookie, { categoryId: "font", site: "UI8", productUrl: "https://ui8.net/f-1" });
  await api("/api/cart", buyerCookie, { categoryId: "video", site: "Shutterstock", productUrl: "https://www.shutterstock.com/v-1" });
  const co = await api("/api/cart/checkout", buyerCookie, { paymentMethod: "gateway", idempotencyKey: crypto.randomUUID() });
  check("تسویه‌ی سبد با درگاه شروع شد", co.status === 200, `status=${co.status}`);
  check("قبل از تأیید درگاه کمیسیونی ثبت نشده", (await commissions(affiliate.userId)).length === 1);
  const orderPayment = await prisma.payment.findFirst({ where: { userId: buyer.id, orderId: { not: null } }, orderBy: { createdAt: "desc" } });
  for (let i = 0; i < 2; i++) {
    await fetch(`${BASE_URL}/api/orders/payment/callback?Authority=${orderPayment!.authority}&Status=OK`, { redirect: "manual" });
  }
  list = await commissions(affiliate.userId);
  const expectedBase = 1_700_000n + 8_600_000n;
  const gw = list[1];
  check("callback تکراری فقط یک کمیسیون ساخت", list.length === 2, `تعداد=${list.length}`);
  check("مبنا = جمع قیمت پایه‌ی آیتم‌ها (بدون کارمزد درگاه)، ۵٪", gw?.baseRial === expectedBase && gw?.amountRial === (expectedBase * 5n) / 100n, `${gw?.baseRial} → ${gw?.amountRial}`);

  console.log("\n۶) تغییر درصد روی کمیسیون‌های قبلی اثر ندارد");
  const admin = await sessionFor(randomMobile(), "admin");
  const setPct = await api("/api/admin/payment-settings", admin.cookie, { fields: [{ key: "affiliate.commission_percent", value: 10 }] });
  check("ادمین درصد را ۱۰ کرد", setPct.status === 200, `status=${setPct.status}`);
  const badPct = await api("/api/admin/payment-settings", admin.cookie, { fields: [{ key: "affiliate.commission_percent", value: 80 }] });
  check("درصد خارج از بازه (۸۰) رد می‌شود", badPct.status === 400);
  await api("/api/orders", buyerCookie, { ...orderBody, idempotencyKey: crypto.randomUUID(), productUrl: "https://www.freepik.com/x-2" });
  list = await commissions(affiliate.userId);
  check("سفارش جدید با ۱۰٪ (۲۰٬۰۰۰ ریال)", list[2]?.amountRial === 20_000n && list[2]?.percent === 10);
  check("ردیف‌های قبلی همان ۵٪ ماندند", list[0].percent === 5 && list[0].amountRial === 10_000n);

  console.log("\n۷) تسویه");
  const balance = await balanceOf(affiliate.userId);
  const expectedBalance = list.reduce((s, c) => s + c.amountRial, 0n);
  check("موجودی = جمع کمیسیون‌ها", balance === expectedBalance, `${balance}`);
  const card = luhnCard("603799123456789");
  const idem = crypto.randomUUID();
  const payoutBody = { amountRial: balance.toString(), cardNumber: card, cardHolder: "همکار تست", idempotencyKey: idem };

  const belowMin = await api("/api/affiliate/payouts", affiliate.cookie, payoutBody);
  check("موجودی کمتر از حداقل (۲۰۰ هزار تومان) رد می‌شود", belowMin.status === 422, belowMin.json?.error);

  await setPaymentSetting("affiliate.min_payout_rial", 10_000, admin.userId);
  const badCard = await api("/api/affiliate/payouts", affiliate.cookie, { ...payoutBody, cardNumber: "6037991234567890" === card ? "6037991234567891" : "6037991234567890" });
  check("شماره کارت نامعتبر (Luhn) رد می‌شود", badCard.status === 400, badCard.json?.error);
  const tooMuch = await api("/api/affiliate/payouts", affiliate.cookie, { ...payoutBody, amountRial: (balance + 1n).toString() });
  check("مبلغ بیشتر از موجودی رد می‌شود", tooMuch.status === 422);
  const floatAmount = await api("/api/affiliate/payouts", affiliate.cookie, { ...payoutBody, amountRial: "1000.5" });
  check("مبلغ اعشاری رد می‌شود", floatAmount.status === 400);

  const p1 = await api("/api/affiliate/payouts", affiliate.cookie, { ...payoutBody, cardNumber: card.replace(/(\d{4})/g, "$1 ").trim() });
  check("درخواست تسویه ثبت شد (کارت با فاصله هم پذیرفته شد)", p1.status === 200 && p1.json?.status === "requested", JSON.stringify(p1.json));
  check("موجودی hold شد (صفر)", (await balanceOf(affiliate.userId)) === 0n);
  const p1Again = await api("/api/affiliate/payouts", affiliate.cookie, payoutBody);
  check("تکرار با همان idempotencyKey همان درخواست را برمی‌گرداند", p1Again.json?.id === p1.json?.id);
  const p2 = await api("/api/affiliate/payouts", affiliate.cookie, { ...payoutBody, idempotencyKey: crypto.randomUUID() });
  check("درخواست دوم هم‌زمان رد می‌شود", p2.status === 422, p2.json?.error);

  const dash = await api("/api/affiliate", affiliate.cookie);
  const dashJson = JSON.stringify(dash.json);
  check("داشبورد همکار شماره کارت کامل را نشان نمی‌دهد", !dashJson.includes(card) && dash.json?.dashboard?.payouts?.[0]?.card?.includes("****"));
  check("داشبورد همکار موبایل کامل زیرمجموعه را نشان نمی‌دهد", !dashJson.includes(buyerMobile) && dash.json?.dashboard?.referralsCount === 1);

  console.log("\n۸) بررسی ادمین");
  const userTry = await api(`/api/admin/affiliate/payouts/${p1.json.id}`, affiliate.cookie, { action: "paid", bankRef: "123456" });
  check("کاربر عادی نمی‌تواند تسویه را تأیید کند (۴۰۳)", userTry.status === 403);
  const userList = await api("/api/admin/affiliate/payouts", affiliate.cookie);
  check("کاربر عادی لیست تسویه‌ها را نمی‌بیند (۴۰۳)", userList.status === 403);
  const adminList = await api("/api/admin/affiliate/payouts?status=requested", admin.cookie);
  check("ادمین درخواست باز را با کارت کامل می‌بیند", adminList.json?.items?.some((i: any) => i.id === p1.json.id && i.cardNumber === card));

  const rejectNoNote = await api(`/api/admin/affiliate/payouts/${p1.json.id}`, admin.cookie, { action: "rejected" });
  check("رد بدون دلیل پذیرفته نمی‌شود", rejectNoNote.status === 400);
  const rej = await api(`/api/admin/affiliate/payouts/${p1.json.id}`, admin.cookie, { action: "rejected", note: "نام صاحب کارت مطابقت ندارد" });
  check("ادمین درخواست را رد کرد", rej.json?.status === "rejected");
  check("مبلغ به موجودی برگشت", (await balanceOf(affiliate.userId)) === balance);
  const rej2 = await api(`/api/admin/affiliate/payouts/${p1.json.id}`, admin.cookie, { action: "paid", bankRef: "999" });
  check("درخواست بررسی‌شده دوباره قابل تغییر نیست", rej2.status === 422);

  const p3 = await api("/api/affiliate/payouts", affiliate.cookie, { ...payoutBody, idempotencyKey: crypto.randomUUID() });
  const paid = await api(`/api/admin/affiliate/payouts/${p3.json.id}`, admin.cookie, { action: "paid", bankRef: "REF-778899" });
  check("درخواست جدید ثبت و «واریز شد»", paid.json?.status === "paid");
  check("موجودی بعد از واریز صفر است", (await balanceOf(affiliate.userId)) === 0n);

  console.log("\n۹) بازگشت وجه و برگشت کمیسیون");
  const walletOf = async (userId: string) => (await prisma.wallet.findUnique({ where: { userId } }))!.balanceRial;
  const refundKey = crypto.randomUUID();
  await api("/api/orders", buyerCookie, { ...orderBody, idempotencyKey: refundKey, productUrl: "https://www.freepik.com/x-refund" });
  const refundOrder = (await prisma.order.findUnique({ where: { idempotencyKey: refundKey } }))!;
  const refundCommission = await prisma.affiliateLedger.findUnique({ where: { idempotencyKey: `commission:order:${refundOrder.id}` } });
  check("سفارش جدید کمیسیون ساخت", !!refundCommission, String(refundCommission?.amountRial));
  const affBefore = await balanceOf(affiliate.userId);
  const buyerWalletBefore = await walletOf(buyer.id);

  const userRefund = await api(`/api/admin/orders/${refundOrder.id}/refund`, buyerCookie, { reason: "تست" });
  check("کاربر عادی نمی‌تواند بازگشت وجه بزند (۴۰۳)", userRefund.status === 403);
  const noReason = await api(`/api/admin/orders/${refundOrder.id}/refund`, admin.cookie, {});
  check("بازگشت وجه بدون دلیل رد می‌شود", noReason.status === 400);

  const r1 = await api(`/api/admin/orders/${refundOrder.id}/refund`, admin.cookie, { reason: "فایل در سایت مبدأ حذف شده بود" });
  check("سفارش در صف → لغوشده", r1.status === 200 && r1.json?.status === "cancelled", JSON.stringify(r1.json));
  check("کل مبلغ پرداختی (با کارمزد) به کیف پول برگشت", (await walletOf(buyer.id)) - buyerWalletBefore === refundOrder.totalPriceRial, `${refundOrder.totalPriceRial}`);
  const reversal = await prisma.affiliateLedger.findUnique({ where: { idempotencyKey: `commission_reversal:order:${refundOrder.id}` } });
  check("کمیسیون همان سفارش با همان مبلغ برگشت خورد", reversal?.amountRial === refundCommission?.amountRial);
  check("موجودی همکار به همان اندازه کم شد", (await balanceOf(affiliate.userId)) === affBefore - (refundCommission?.amountRial ?? 0n));

  const r2 = await api(`/api/admin/orders/${refundOrder.id}/refund`, admin.cookie, { reason: "دوباره" });
  check("بازگشت وجه دوم رد می‌شود و پولی جابه‌جا نمی‌شود", r2.status === 422 && (await walletOf(buyer.id)) - buyerWalletBefore === refundOrder.totalPriceRial);
  const events = await prisma.orderEvent.findMany({ where: { orderId: refundOrder.id, actor: `admin:${admin.userId}` } });
  check("رویداد audit با actor ادمین ثبت شد", events.length === 1 && events[0].toStatus === "cancelled");

  // سفارشی که قبلاً کمیسیونش تسویه شده: برگشت کمیسیون موجودی را منفی (بدهی) می‌کند.
  const paidOrderId = list[0].orderId!;
  await prisma.order.update({ where: { id: paidOrderId }, data: { status: "processing" } });
  const balBeforeDebt = await balanceOf(affiliate.userId);
  const r3 = await api(`/api/admin/orders/${paidOrderId}/refund`, admin.cookie, { reason: "خطای اپراتور" });
  check("سفارش در حال پردازش → failed → refunded", r3.json?.status === "refunded");
  const r3Events = await prisma.orderEvent.findMany({ where: { orderId: paidOrderId, actor: `admin:${admin.userId}` }, orderBy: { createdAt: "asc" } });
  check("هر دو گام state machine ثبت شد", r3Events.map((e) => e.toStatus).join(",") === "failed,refunded");
  const debt = await balanceOf(affiliate.userId);
  check("کمیسیونِ تسویه‌شده برگشت خورد و موجودی منفی (بدهی) شد", debt === balBeforeDebt - list[0].amountRial && debt < 0n, `${debt}`);
  const debtPayout = await api("/api/affiliate/payouts", affiliate.cookie, { ...payoutBody, amountRial: "10000", idempotencyKey: crypto.randomUUID() });
  check("با موجودی منفی درخواست تسویه ممکن نیست", debtPayout.status === 422);

  const deliveredKey = crypto.randomUUID();
  await api("/api/orders", buyerCookie, { ...orderBody, idempotencyKey: deliveredKey, productUrl: "https://www.freepik.com/x-delivered" });
  const delivered = (await prisma.order.findUnique({ where: { idempotencyKey: deliveredKey } }))!;
  await prisma.order.update({ where: { id: delivered.id }, data: { status: "delivered" } });
  const r4 = await api(`/api/admin/orders/${delivered.id}/refund`, admin.cookie, { reason: "تست" });
  check("سفارش تحویل‌شده قابل بازگشت وجه نیست", r4.status === 422);

  const plainKey = crypto.randomUUID();
  const plainCookie = (await sessionFor(existingMobile)).cookie;
  await creditWallet(existing.userId, 5_000_000n, null, "شارژ تست");
  await api("/api/orders", plainCookie, { ...orderBody, idempotencyKey: plainKey, productUrl: "https://www.freepik.com/x-plain" });
  const plain = (await prisma.order.findUnique({ where: { idempotencyKey: plainKey } }))!;
  const ledgerCountBefore = await prisma.affiliateLedger.count();
  const r5 = await api(`/api/admin/orders/${plain.id}/refund`, admin.cookie, { reason: "کاربر بدون معرف" });
  check("بازگشت وجه سفارش کاربرِ بدون معرف، بدون ردیف کمیسیون", r5.status === 200 && (await prisma.affiliateLedger.count()) === ledgerCountBefore);

  const dashAfter = await api("/api/affiliate", affiliate.cookie);
  check("داشبورد همکار ردیف برگشتی را نشان می‌دهد", dashAfter.json?.dashboard?.commissions?.some((c: any) => c.reversal === true));

  console.log("\n۱۰) مدیریت همکاران در پنل ادمین");
  const affList = await api(`/api/admin/affiliate/affiliates?q=${code}`, admin.cookie);
  const row = affList.json?.items?.[0];
  check("ادمین همکار را با کد پیدا می‌کند", affList.json?.total === 1 && row?.code === code && row?.referralsCount === 1);
  const affListUser = await api("/api/admin/affiliate/affiliates", affiliate.cookie);
  check("کاربر عادی لیست همکاران را نمی‌بیند (۴۰۳)", affListUser.status === 403);

  console.log("\n۱۱) اعلان‌های خودکار");
  const notes = await prisma.notification.findMany({ where: { userId: affiliate.userId } });
  const has = (t: string) => notes.some((n) => n.text.includes(t) && n.href === "/affiliate");
  check("اعلان زیرمجموعه‌ی جدید", has("با لینک تو ثبت‌نام کرد"));
  check("اعلان کمیسیون", has("همکاری‌ات اضافه شد"));
  check("اعلان برگشت کمیسیون", has("برگشت خورد"));
  check("اعلان واریز و رد تسویه", has("به کارتت واریز شد") && has("رد شد"));

  console.log("\n۱۲) تعلیق همکار");
  const affPath = `/api/admin/affiliate/affiliates/${affiliate.userId}`;
  const suspUser = await api(affPath, affiliate.cookie, { action: "suspend", reason: "تست" });
  check("کاربر عادی نمی‌تواند تعلیق کند (۴۰۳)", suspUser.status === 403);
  const susp = await api(affPath, admin.cookie, { action: "suspend", reason: "تقلب احتمالی در ثبت‌نام‌ها" });
  check("ادمین همکار را معلق کرد", susp.status === 200);
  check("تعلیق دوباره خطا می‌دهد", (await api(affPath, admin.cookie, { action: "suspend", reason: "دوباره" })).status === 422);

  const suspMobile = randomMobile();
  await otpLogin(suspMobile, refCookie);
  check("لینک همکار معلق زیرمجموعه ثبت نمی‌کند", (await prisma.user.findUnique({ where: { mobile: suspMobile } }))?.referredById === null);
  const cBefore = (await commissions(affiliate.userId)).length;
  await api("/api/orders", buyerCookie, { ...orderBody, idempotencyKey: crypto.randomUUID(), productUrl: "https://www.freepik.com/x-susp" });
  check("خرید زیرمجموعه‌ی همکار معلق کمیسیون نمی‌سازد", (await commissions(affiliate.userId)).length === cBefore);
  const suspDash = await api("/api/affiliate", affiliate.cookie);
  check("داشبورد همکار وضعیت تعلیق و دلیل را نشان می‌دهد", suspDash.json?.dashboard?.suspended === true && suspDash.json?.dashboard?.suspendReason?.includes("تقلب"));

  const unsusp = await api(affPath, admin.cookie, { action: "unsuspend", reason: "بررسی شد، مشکلی نبود" });
  check("رفع تعلیق", unsusp.status === 200);
  await api("/api/orders", buyerCookie, { ...orderBody, idempotencyKey: crypto.randomUUID(), productUrl: "https://www.freepik.com/x-unsusp" });
  check("بعد از رفع تعلیق کمیسیون دوباره ثبت می‌شود", (await commissions(affiliate.userId)).length === cBefore + 1);

  console.log("\n۱۳) اصلاح دستی موجودی");
  const balBeforeAdj = await balanceOf(affiliate.userId);
  const adjKey = crypto.randomUUID();
  const adj = { action: "adjust", direction: "credit", amountRial: "500000", reason: "جایزه‌ی کمپین", idempotencyKey: adjKey };
  check("کاربر عادی نمی‌تواند موجودی اصلاح کند (۴۰۳)", (await api(affPath, affiliate.cookie, adj)).status === 403);
  await api(affPath, admin.cookie, adj);
  await api(affPath, admin.cookie, adj);
  check("افزایش دستی یک‌بار اعمال شد (idempotent)", (await balanceOf(affiliate.userId)) === balBeforeAdj + 500_000n);
  const bigDebit = await api(affPath, admin.cookie, { ...adj, direction: "debit", amountRial: "999999999", idempotencyKey: crypto.randomUUID() });
  check("کاهش بیشتر از موجودی رد می‌شود", bigDebit.status === 422);
  const debit = await api(affPath, admin.cookie, { ...adj, direction: "debit", amountRial: "100000", reason: "اصلاح خطا", idempotencyKey: crypto.randomUUID() });
  check("کاهش دستی اعمال شد", debit.status === 200 && (await balanceOf(affiliate.userId)) === balBeforeAdj + 400_000n);
  check("مبلغ اعشاری رد می‌شود", (await api(affPath, admin.cookie, { ...adj, amountRial: "10.5", idempotencyKey: crypto.randomUUID() })).status === 400);

  console.log("\n۱۴) تغییر معرف توسط ادمین");
  const aff2 = await sessionFor(randomMobile());
  const code2: string = (await api("/api/affiliate/join", aff2.cookie, {})).json.code;
  const refPath = (id: string) => `/api/admin/users/${id}/referrer`;
  check("کاربر عادی نمی‌تواند معرف را عوض کند (۴۰۳)", (await api(refPath(buyer.id), buyerCookie, { code: code2, reason: "تست" })).status === 403);
  check("معرف نمی‌تواند خودِ کاربر باشد", (await api(refPath(affiliate.userId), admin.cookie, { code, reason: "تست" })).status === 422);
  check("کد ناموجود رد می‌شود", (await api(refPath(buyer.id), admin.cookie, { code: "ZZZZZZZ", reason: "تست" })).status === 422);
  const move = await api(refPath(buyer.id), admin.cookie, { code: code2, reason: "درخواست کتبی کاربر" });
  check("معرف زیرمجموعه عوض شد", move.status === 200 && (await prisma.user.findUnique({ where: { id: buyer.id } }))?.referredById === aff2.userId);
  const c2Before = (await commissions(aff2.userId)).length;
  await api("/api/orders", buyerCookie, { ...orderBody, idempotencyKey: crypto.randomUUID(), productUrl: "https://www.freepik.com/x-moved" });
  check("کمیسیون خرید بعدی به معرف جدید رسید", (await commissions(aff2.userId)).length === c2Before + 1);
  await api(refPath(affiliate.userId), admin.cookie, { code: code2, reason: "زنجیره" });
  check("حلقه‌ی معرف (A←B و B←A) رد می‌شود", (await api(refPath(aff2.userId), admin.cookie, { code, reason: "حلقه" })).status === 422);
  const removed = await api(refPath(buyer.id), admin.cookie, { code: null, reason: "حذف معرف" });
  check("حذف معرف", removed.status === 200 && (await prisma.user.findUnique({ where: { id: buyer.id } }))?.referredById === null);
  const logs = await prisma.affiliateAdminLog.findMany({ where: { targetUserId: { in: [affiliate.userId, buyer.id] } } });
  check("همه‌ی اقدامات ادمین در لاگ ثبت شدند", ["suspend", "unsuspend", "adjust_balance", "set_referrer"].every((a) => logs.some((l) => l.action === a)), `${logs.length} ردیف`);

  const detail = await api(affPath, admin.cookie);
  check("صفحه‌ی جزئیات همکار: دفتر، زیرمجموعه، تسویه و لاگ", detail.json?.ledger?.length > 0 && detail.json?.logs?.length > 0 && Array.isArray(detail.json?.referrals) && detail.json?.payouts?.length > 0);
  check("کاربر عادی جزئیات همکار را نمی‌بیند (۴۰۳)", (await api(affPath, affiliate.cookie)).status === 403);

  console.log("\n۱۶) دوره‌ی انتظار کمیسیون (۷ روز)");
  await setPaymentSetting("affiliate.hold_days", 7, admin.userId);
  const holdAff = await sessionFor(randomMobile());
  const holdCode: string = (await api("/api/affiliate/join", holdAff.cookie, {})).json.code;
  const holdBuyerMobile = randomMobile();
  const holdBuyerCookie = await otpLogin(holdBuyerMobile, `mj_ref=${holdCode}`, "10.20.0.1");
  const holdBuyer = (await prisma.user.findUnique({ where: { mobile: holdBuyerMobile } }))!;
  await creditWallet(holdBuyer.id, 20_000_000n, null, "شارژ تست");
  const placeOrder = async (tag: string) => {
    const k = crypto.randomUUID();
    await api("/api/orders", holdBuyerCookie, { ...orderBody, idempotencyKey: k, productUrl: `https://www.freepik.com/${tag}` });
    return (await prisma.order.findUnique({ where: { idempotencyKey: k } }))!;
  };
  const cron = async () => (await fetch(`${BASE_URL}/api/cron/affiliate`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` } })).json();

  const h1 = await placeOrder("hold-1");
  const p1Row = await prisma.affiliatePendingCommission.findUnique({ where: { orderId: h1.id } });
  // درصد در بخش ۶ روی ۱۰٪ مانده: ۱۰٪ از ۲۰۰٬۰۰۰ ریال = ۲۰٬۰۰۰ ریال.
  check("بعد از پرداخت کمیسیون «در انتظار» است", p1Row?.status === "pending" && p1Row.amountRial === 20_000n, `${p1Row?.status}/${p1Row?.amountRial}`);
  check("موجودی قابل برداشت هنوز صفر است", (await balanceOf(holdAff.userId)) === 0n);
  const holdDash = (await api("/api/affiliate", holdAff.cookie)).json?.dashboard;
  check("داشبورد همکار مبلغ در انتظار را نشان می‌دهد", holdDash?.pendingCount === 1 && holdDash?.pendingLabel?.includes("۲,۰۰۰"));
  await cron();
  check("سفارش در صف با cron آزاد نمی‌شود", (await prisma.affiliatePendingCommission.findUnique({ where: { orderId: h1.id } }))?.status === "pending");

  // اپراتور سفارش را تا «تحویل‌شده» جلو می‌برد → آزادسازی فوری.
  const operator = await sessionFor(randomMobile(), "operator");
  const opStatus = (id: string, toStatus: string) => api(`/api/operator/orders/${id}/status`, operator.cookie, { toStatus });
  check("اپراتور نمی‌تواند سفارش پرداخت‌شده را «لغو» کند (پول برنمی‌گشت)", (await opStatus(h1.id, "cancelled")).status === 422);
  for (const st of ["processing", "ready", "delivered"]) await opStatus(h1.id, st);
  check("با تحویل سفارش کمیسیون آزاد شد", (await prisma.affiliatePendingCommission.findUnique({ where: { orderId: h1.id } }))?.status === "released" && (await balanceOf(holdAff.userId)) === 20_000n);
  check("اپراتور نمی‌تواند «بازگشت وجه» بزند", (await opStatus(h1.id, "refunded")).status === 422);

  // سفارش «آماده» که دانلود نهایی نشده: بعد از ۷ روز cron آزادش می‌کند.
  const h2 = await placeOrder("hold-2");
  for (const st of ["processing", "ready"]) await opStatus(h2.id, st);
  await cron();
  check("سفارش آماده، پیش از ۷ روز آزاد نمی‌شود", (await prisma.affiliatePendingCommission.findUnique({ where: { orderId: h2.id } }))?.status === "pending");
  await prisma.affiliatePendingCommission.update({ where: { orderId: h2.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } });
  const cronRes = await cron();
  check("بعد از ۷ روز cron آن را آزاد کرد", cronRes.released >= 1 && (await prisma.affiliatePendingCommission.findUnique({ where: { orderId: h2.id } }))?.status === "released");

  // بازگشت وجه پیش از آزادسازی: فقط لغو، بدون جابه‌جایی پول همکار و بدون بدهی.
  const h3 = await placeOrder("hold-3");
  const balBeforeH3 = await balanceOf(holdAff.userId);
  await api(`/api/admin/orders/${h3.id}/refund`, admin.cookie, { reason: "فایل موجود نبود" });
  check("بازگشت وجه پیش از تحویل: کمیسیون در انتظار لغو شد", (await prisma.affiliatePendingCommission.findUnique({ where: { orderId: h3.id } }))?.status === "cancelled");
  check("موجودی همکار دست نخورد (بدون بدهی)", (await balanceOf(holdAff.userId)) === balBeforeH3);
  check("ردیف برگشتی در دفتر ساخته نشد", (await prisma.affiliateLedger.count({ where: { orderId: h3.id } })) === 0);

  // همکار معلق: آزادسازی متوقف و بعد از رفع تعلیق انجام می‌شود.
  const h4 = await placeOrder("hold-4");
  await api(`/api/admin/affiliate/affiliates/${holdAff.userId}`, admin.cookie, { action: "suspend", reason: "بررسی" });
  for (const st of ["processing", "ready", "delivered"]) await opStatus(h4.id, st);
  check("کمیسیون همکار معلق حتی با تحویل آزاد نمی‌شود", (await prisma.affiliatePendingCommission.findUnique({ where: { orderId: h4.id } }))?.status === "pending");
  await api(`/api/admin/affiliate/affiliates/${holdAff.userId}`, admin.cookie, { action: "unsuspend", reason: "رفع شد" });
  await cron();
  check("بعد از رفع تعلیق، cron آزادش کرد", (await prisma.affiliatePendingCommission.findUnique({ where: { orderId: h4.id } }))?.status === "released");

  console.log("\n۱۷) تشخیص خودکار تقلب");
  const fraudAffMobile = randomMobile();
  const fraudAffCookie = await otpLogin(fraudAffMobile, "", "10.66.0.7");
  const fraudCode: string = (await api("/api/affiliate/join", fraudAffCookie, {})).json.code;
  const fraudAff = (await prisma.user.findUnique({ where: { mobile: fraudAffMobile } }))!;
  check("IP ورود همکار ثبت شد", fraudAff.lastLoginIp === "10.66.0.7" && fraudAff.signupIp === "10.66.0.7");
  const selfMobile = randomMobile();
  await otpLogin(selfMobile, `mj_ref=${fraudCode}`, "10.66.0.7");
  await new Promise((r) => setTimeout(r, 500));
  const flagsOf = (kind: string) => prisma.affiliateFraudFlag.findMany({ where: { affiliateId: fraudAff.id, kind } });
  check("زیرمجموعه از IP خود همکار → هشدار same_ip", (await flagsOf("same_ip")).length === 1);
  const cleanMobile = randomMobile();
  await otpLogin(cleanMobile, `mj_ref=${fraudCode}`, "10.77.1.1");
  await new Promise((r) => setTimeout(r, 500));
  check("زیرمجموعه‌ی عادی هشدار نمی‌سازد", (await flagsOf("same_ip")).length === 1 && (await flagsOf("ip_burst")).length === 0);
  for (let i = 0; i < 3; i++) await otpLogin(randomMobile(), `mj_ref=${fraudCode}`, "10.88.8.8");
  await new Promise((r) => setTimeout(r, 500));
  check("۳ ثبت‌نام از یک IP در ۲۴ ساعت → یک هشدار ip_burst (بدون تکرار)", (await flagsOf("ip_burst")).length === 1);

  await setPaymentSetting("affiliate.min_payout_rial", 10_000, admin.userId);
  const sharedCard = luhnCard("621986123456789");
  const cardPayout = async (cookie: string, userId: string) => {
    await api(`/api/admin/affiliate/affiliates/${userId}`, admin.cookie, { action: "adjust", direction: "credit", amountRial: "100000", reason: "تست", idempotencyKey: crypto.randomUUID() });
    return api("/api/affiliate/payouts", cookie, { amountRial: "100000", cardNumber: sharedCard, cardHolder: "یک نفر", idempotencyKey: crypto.randomUUID() });
  };
  await cardPayout(holdAff.cookie, holdAff.userId);
  const sp = await cardPayout(fraudAffCookie, fraudAff.id);
  await new Promise((r) => setTimeout(r, 500));
  check("درخواست تسویه با کارت همکار دیگر ثبت شد ولی هشدار shared_card ساخت", sp.status === 200 && (await flagsOf("shared_card")).length === 1);

  const flagList = await api(`/api/admin/affiliate/flags?status=open&affiliateId=${fraudAff.id}`, admin.cookie);
  check("ادمین هشدارهای باز همکار را می‌بیند", flagList.json?.total === 3);
  check("کاربر عادی هشدارها را نمی‌بیند (۴۰۳)", (await api("/api/admin/affiliate/flags", fraudAffCookie)).status === 403);
  const payoutsView = await api("/api/admin/affiliate/payouts?status=requested", admin.cookie);
  check("در لیست تسویه، هشدار باز همکار نمایش داده می‌شود", payoutsView.json?.items?.some((i: any) => i.user.id === fraudAff.id && i.user.openFlags === 3));
  const flagId = flagList.json.items[0].id;
  check("بستن هشدار بدون نتیجه رد می‌شود", (await api(`/api/admin/affiliate/flags/${flagId}`, admin.cookie, {})).status === 400);
  check("ادمین هشدار را بست", (await api(`/api/admin/affiliate/flags/${flagId}`, admin.cookie, { resolution: "همکار و همسرش، مشکلی نیست" })).status === 200);
  check("بستن دوباره خطا می‌دهد", (await api(`/api/admin/affiliate/flags/${flagId}`, admin.cookie, { resolution: "دوباره" })).status === 422);

  console.log("\n۱۸) گزارش ادمین");
  const report = await api("/api/admin/affiliate/report", admin.cookie);
  const dbOpenFlags = await prisma.affiliateFraudFlag.count({ where: { resolvedAt: null } });
  const dbPending = await prisma.affiliatePendingCommission.count({ where: { status: "pending" } });
  check("گزارش: تعداد هشدار باز و کمیسیون در انتظار با دیتابیس یکی است", report.json?.totals?.openFlags === dbOpenFlags && report.json?.totals?.pendingCount === dbPending);
  check("گزارش: بهترین همکاران فهرست شده‌اند", Array.isArray(report.json?.top) && report.json.top.length > 0);
  check("کاربر عادی گزارش را نمی‌بیند (۴۰۳)", (await api("/api/admin/affiliate/report", fraudAffCookie)).status === 403);

  console.log("\n۱۹) سازگاری دفتر");
  const entries = await prisma.affiliateLedger.findMany({ where: { account: { userId: affiliate.userId } }, orderBy: { createdAt: "asc" } });
  let running = 0n;
  let consistent = true;
  for (const e of entries) {
    running += ["payout_hold", "commission_reversal", "adjustment_debit"].includes(e.type) ? -e.amountRial : e.amountRial;
    if (running !== e.balanceAfter) consistent = false;
  }
  check("هر ردیف balanceAfter درست دارد و مجموع = موجودی", consistent && running === (await balanceOf(affiliate.userId)), `${entries.length} ردیف`);

  // پاک‌سازی تنظیمات تا پیش‌فرض‌ها برگردند.
  await prisma.siteContent.deleteMany({ where: { key: { startsWith: "affiliate." } } });

  console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
