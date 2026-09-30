// تست شارژ کیف پول از درگاه (نیازمند سرور dev با درگاه mock):
// [۱] شارژ موفق، [۲] انصراف بدون تغییر موجودی، [۳] callback تکراری فقط یک‌بار شارژ می‌کند،
// [۴] مبلغ کمتر از حداقل شارژ رد می‌شود.

import { prisma } from "../lib/db";
import { BASE_URL, check, run, makeSessionCookie, randomMobile, readJson } from "./testUtils";

async function postCharge(cookie: string, amountRial: number) {
  const res = await fetch(`${BASE_URL}/api/wallet/charge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ amountRial }),
    redirect: "manual",
  });
  return { status: res.status, json: await readJson(res) };
}

function extractCallback(redirectUrl: string): { authority: string; callback: string } {
  const url = new URL(redirectUrl, BASE_URL);
  return { authority: url.searchParams.get("authority")!, callback: url.searchParams.get("callback")! };
}

async function callCallback(callback: string, authority: string, status: "OK" | "NOK") {
  const url = new URL(callback);
  url.searchParams.set("Authority", authority);
  url.searchParams.set("Status", status);
  return fetch(url.toString(), { redirect: "manual" });
}

async function balanceOf(userId: string): Promise<bigint> {
  return (await prisma.wallet.findUniqueOrThrow({ where: { userId } })).balanceRial;
}

// شارژ را شروع می‌کند؛ اگر درگاه لینک نداد، شکست را ثبت و null برمی‌گرداند.
async function startCharge(label: string, cookie: string, amountRial: number) {
  const r = await postCharge(cookie, amountRial);
  const ok = r.status === 200 && typeof r.json?.redirectUrl === "string";
  check(`${label} شروع شارژ ${amountRial} ریال → 200 با redirectUrl`, ok, r);
  return ok ? extractCallback(r.json.redirectUrl) : null;
}

run(async () => {
  const user = await prisma.user.create({ data: { mobile: randomMobile("0902"), wallet: { create: { balanceRial: 0n } } } });
  const cookie = await makeSessionCookie(user.id);

  // [۱] شارژ موفق
  const c1 = await startCharge("[۱]", cookie, 1_500_000);
  if (c1) {
    await callCallback(c1.callback, c1.authority, "OK");
    check("[۱] موجودی پس از شارژ = 1500000", (await balanceOf(user.id)) === 1_500_000n);
    const p1 = await prisma.payment.findUnique({ where: { authority: c1.authority } });
    check("[۱] Payment verified", p1?.status === "verified", p1?.status);
  }

  // [۲] انصراف: موجودی بدون تغییر
  const c2 = await startCharge("[۲]", cookie, 1_200_000);
  if (c2) {
    await callCallback(c2.callback, c2.authority, "NOK");
    check("[۲] موجودی بدون تغییر (1500000)", (await balanceOf(user.id)) === 1_500_000n);
    const p2 = await prisma.payment.findUnique({ where: { authority: c2.authority } });
    check("[۲] Payment failed", p2?.status === "failed", p2?.status);
  }

  // [۳] callback تکراری
  const c3 = await startCharge("[۳]", cookie, 1_000_000);
  if (c3) {
    await callCallback(c3.callback, c3.authority, "OK");
    const afterFirst = await balanceOf(user.id);
    await callCallback(c3.callback, c3.authority, "OK");
    const afterSecond = await balanceOf(user.id);
    check("[۳] callback تکراری فقط یک‌بار شارژ می‌کند (2500000)", afterFirst === 2_500_000n && afterSecond === afterFirst, {
      afterFirst,
      afterSecond,
    });
    const payment = await prisma.payment.findUniqueOrThrow({ where: { authority: c3.authority } });
    const txCount = await prisma.walletTransaction.count({ where: { ref: payment.id } });
    check("[۳] دقیقاً یک WalletTransaction", txCount === 1, txCount);
  }

  // [۴] کمتر از حداقل شارژ
  const r4 = await postCharge(cookie, 500_000);
  check("[۴] مبلغ کمتر از حداقل → 422", r4.status === 422, r4);
});
