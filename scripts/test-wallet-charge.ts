import { prisma } from "../lib/db";
import crypto from "crypto";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

async function loginAs(mobile: string): Promise<string> {
  const user = await prisma.user.upsert({
    where: { mobile },
    update: {},
    create: { mobile, wallet: { create: { balanceRial: 0n } } },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.session.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 86400000) },
  });

  return token;
}

function cookieHeader(token: string) {
  return { Cookie: `mediajet_session=${token}` };
}

async function postCharge(token: string, amountRial: number) {
  const res = await fetch(`${BASE_URL}/api/wallet/charge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cookieHeader(token) },
    body: JSON.stringify({ amountRial }),
    redirect: "manual",
  });
  const json = await res.json();
  return { status: res.status, json };
}

function extractCallbackFromRedirect(redirectUrl: string): { authority: string; callback: string } {
  const url = new URL(redirectUrl, BASE_URL);
  const authority = url.searchParams.get("authority")!;
  const callback = url.searchParams.get("callback")!;
  return { authority, callback };
}

async function callCallback(callback: string, authority: string, status: "OK" | "NOK") {
  const url = new URL(callback);
  url.searchParams.set("Authority", authority);
  url.searchParams.set("Status", status);
  return fetch(url.toString(), { redirect: "manual" });
}

async function getWalletBalance(userId: string): Promise<bigint> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return wallet!.balanceRial;
}

async function main() {
  const mobile = "0902000" + Math.floor(Math.random() * 10000);
  const token = await loginAs(mobile);
  const user = await prisma.user.findUniqueOrThrow({ where: { mobile } });
  console.log("کاربر تست:", user.id);

  // سناریو ۱: شارژ موفق
  const r1 = await postCharge(token, 500000);
  console.log("\n[سناریو ۱] شروع شارژ:", r1.status, r1.json);
  const { authority: auth1, callback: cb1 } = extractCallbackFromRedirect(r1.json.redirectUrl);

  const cbRes1 = await callCallback(cb1, auth1, "OK");
  console.log("  callback status:", cbRes1.status, "→", cbRes1.headers.get("location"));

  const balanceAfter1 = await getWalletBalance(user.id);
  console.log("  موجودی پس از شارژ:", balanceAfter1.toString(), "(انتظار: 500000)");

  const payment1 = await prisma.payment.findUnique({ where: { authority: auth1 } });
  console.log("  وضعیت Payment:", payment1?.status, "(انتظار: verified)");

  // سناریو ۲: انصراف/شکست — موجودی نباید تغییر کند
  const r2 = await postCharge(token, 300000);
  const { authority: auth2, callback: cb2 } = extractCallbackFromRedirect(r2.json.redirectUrl);
  await callCallback(cb2, auth2, "NOK");

  const balanceAfter2 = await getWalletBalance(user.id);
  console.log(
    "\n[سناریو ۲] انصراف؛ موجودی:",
    balanceAfter2.toString(),
    "(انتظار: 500000، بدون تغییر)",
  );
  const payment2 = await prisma.payment.findUnique({ where: { authority: auth2 } });
  console.log("  وضعیت Payment:", payment2?.status, "(انتظار: failed)");

  // سناریو ۳: تأیید تکراری callback — فقط یک‌بار باید شارژ شود
  const r3 = await postCharge(token, 200000);
  const { authority: auth3, callback: cb3 } = extractCallbackFromRedirect(r3.json.redirectUrl);
  await callCallback(cb3, auth3, "OK");
  const balanceAfterFirst = await getWalletBalance(user.id);
  await callCallback(cb3, auth3, "OK"); // تکراری
  const balanceAfterSecond = await getWalletBalance(user.id);

  console.log(
    "\n[سناریو ۳] callback تکراری؛ موجودی بعد از اولین:",
    balanceAfterFirst.toString(),
    "بعد از تکراری:",
    balanceAfterSecond.toString(),
    "(انتظار: برابر، 700000)",
  );

  const txCount = await prisma.walletTransaction.count({
    where: { ref: (await prisma.payment.findUnique({ where: { authority: auth3 } }))!.id },
  });
  console.log("  تعداد WalletTransaction برای این پرداخت:", txCount, "(انتظار: ۱)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
