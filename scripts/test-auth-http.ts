// تست end-to-end جریان HTTP واقعی: درخواست OTP → خواندن کد از کنسول سرور (لاگ فایل) →
// تأیید → ساخت session (کوکی httpOnly) → ثبت سفارش با همان کوکی، بدون ارسال userId.
// نیازمند اجرای سرور dev با خروجی هدایت‌شده به یک فایل لاگ (BASE_URL و LOG_FILE قابل تنظیم).

import { readFileSync } from "fs";
import { prisma } from "../lib/db";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const LOG_FILE = process.env.LOG_FILE;

function extractCodeFromLog(mobile: string): string {
  if (!LOG_FILE) {
    throw new Error("LOG_FILE تنظیم نشده است.");
  }
  const log = readFileSync(LOG_FILE, "utf-8");
  const lines = log.split("\n").filter((l) => l.includes(mobile) && l.includes("کد:"));
  const last = lines[lines.length - 1];
  const match = last?.match(/کد: (\d{6})/);
  if (!match) {
    throw new Error(`کد برای موبایل ${mobile} در لاگ یافت نشد.`);
  }
  return match[1];
}

function extractCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) throw new Error("Set-Cookie یافت نشد.");
  const match = setCookieHeader.match(/mediajet_session=[^;]+/);
  if (!match) throw new Error("کوکی نشست یافت نشد.");
  return match[0];
}

async function main() {
  const mobile = "0919" + Math.floor(1000000 + Math.random() * 8999999);
  console.log("موبایل تست:", mobile);

  const r1 = await fetch(`${BASE_URL}/api/auth/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile }),
  });
  console.log("[۱] درخواست OTP:", r1.status, await r1.json());

  await new Promise((r) => setTimeout(r, 500)); // فرصت برای flush شدن لاگ
  const code = extractCodeFromLog(mobile);
  console.log("[۲] کد خوانده‌شده از لاگ سرور:", code);

  const r2 = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobile, code }),
  });
  const cookie = extractCookie(r2.headers.get("set-cookie"));
  console.log("[۳] تأیید OTP:", r2.status, await r2.json(), "| کوکی دریافت شد:", !!cookie);

  const userId = (await prisma.user.findUnique({ where: { mobile } }))!.id;
  await prisma.walletTransaction.create({
    data: {
      walletId: (await prisma.wallet.findUnique({ where: { userId } }))!.id,
      type: "credit",
      amountRial: 2000000n,
      balanceAfter: 2000000n,
      ref: "seed",
      note: "شارژ اولیه برای تست",
    },
  });
  await prisma.wallet.update({ where: { userId }, data: { balanceRial: 2000000n } });

  const r3 = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      categoryId: "vector",
      site: "Freepik",
      productUrl: "https://freepik.com/some-vector",
      paymentMethod: "wallet",
      idempotencyKey: "http-test-" + userId,
    }),
  });
  console.log("[۴] ثبت سفارش با session (بدون userId در بدنه):", r3.status, await r3.json());

  // بدون کوکی باید رد شود
  const r4 = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      categoryId: "vector",
      site: "Freepik",
      productUrl: "https://freepik.com/some-vector",
      paymentMethod: "wallet",
      idempotencyKey: "http-test-noauth-" + userId,
    }),
  });
  console.log("[۵] ثبت سفارش بدون ورود (انتظار 401):", r4.status, await r4.json());

  const r5 = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  console.log("[۶] خروج:", r5.status, await r5.json());

  const r6 = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      categoryId: "vector",
      site: "Freepik",
      productUrl: "https://freepik.com/some-vector",
      paymentMethod: "wallet",
      idempotencyKey: "http-test-afterlogout-" + userId,
    }),
  });
  console.log("[۷] استفاده از کوکی بعد از خروج (انتظار 401):", r6.status, await r6.json());
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
