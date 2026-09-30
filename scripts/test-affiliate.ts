// تست end-to-end همکاری در فروش.
// اجرا: سرور dev با خروجی هدایت‌شده به فایل لاگ بالا باشد، سپس
//   LOG_FILE=<مسیر لاگ> npx tsx scripts/test-affiliate.ts
//
// پوشش: عضویت و کد یکتا، ثبت زیرمجموعه فقط هنگام ساخت کاربر، نبودِ کمیسیون روی شارژ کیف پول،
// کمیسیون روی سفارش کیف پول و درگاه (فقط یک‌بار، مبنای بدون کارمزد)، ثابت ماندن درصد ردیف‌های قبلی،
// تسویه (حداقل مبلغ، کارت نامعتبر، درخواست باز، idempotency، رد و بازگشت، واریز)، دسترسی ادمین،
// و سازگاری دفتر با موجودی.

import crypto from "crypto";
import { readFileSync } from "fs";
import { prisma } from "../lib/db";
import { creditWallet } from "../lib/wallet";
import { setPaymentSetting } from "../lib/paymentSettings";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const LOG_FILE = process.env.LOG_FILE;

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) passed++; else failed++;
  console.log(`  ${condition ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const randomMobile = () => "0912" + Math.floor(1000000 + Math.random() * 8999999);

async function sessionFor(mobile: string, role: "user" | "admin" = "user"): Promise<{ userId: string; cookie: string }> {
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

function otpFromLog(mobile: string): string {
  if (!LOG_FILE) throw new Error("LOG_FILE تنظیم نشده است.");
  const lines = readFileSync(LOG_FILE, "utf-8").split("\n").filter((l) => l.includes(mobile) && l.includes("پیامک شبیه‌سازی"));
  const match = lines[lines.length - 1]?.match(/(\d{6})\s*$/);
  if (!match) throw new Error(`کد OTP برای ${mobile} در لاگ نیست.`);
  return match[1];
}

/** ثبت‌نام/ورود واقعی با OTP، با کوکی دلخواه (مثلاً mj_ref). */
async function otpLogin(mobile: string, extraCookie = ""): Promise<string> {
  await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile }),
  });
  await new Promise((r) => setTimeout(r, 400));
  const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: extraCookie },
    body: JSON.stringify({ mobile, code: otpFromLog(mobile) }),
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

  console.log("\n۹) سازگاری دفتر");
  const entries = await prisma.affiliateLedger.findMany({ where: { account: { userId: affiliate.userId } }, orderBy: { createdAt: "asc" } });
  let running = 0n;
  let consistent = true;
  for (const e of entries) {
    running += e.type === "payout_hold" ? -e.amountRial : e.amountRial;
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
