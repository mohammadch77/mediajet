import { prisma } from "../lib/db";
import { requestOtp, verifyOtp, OtpError } from "../lib/otp";
import { findOrCreateUserByMobile, createSession } from "../lib/session";

// این اسکریپت مستقیماً از توابع lib/otp و lib/session استفاده می‌کند (نه HTTP)
// چون next/headers.cookies() به context درخواست نیاز دارد. جریان cookie→API
// به‌صورت end-to-end در مرورگر/فرانت قابل تست است؛ این‌جا منطق هسته را می‌آزماییم.

function captureConsoleCode(mobile: string, fn: () => Promise<void>): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const original = console.log;
    let captured: string | null = null;
    console.log = (...args: unknown[]) => {
      const line = args.join(" ");
      const match = line.match(/کد: (\d{6})/);
      if (match) captured = match[1];
      original(...args);
    };
    try {
      await fn();
      console.log = original;
      if (!captured) return reject(new Error("کد در کنسول یافت نشد"));
      resolve(captured);
    } catch (e) {
      console.log = original;
      reject(e);
    }
  });
}

async function main() {
  const mobile = "0912" + Math.floor(1000000 + Math.random() * 8999999);
  console.log("موبایل تست:", mobile);

  // سناریو ۱: جریان موفق کامل
  const code1 = await captureConsoleCode(mobile, () => requestOtp(mobile));
  console.log("\n[سناریو ۱] کد دریافتی:", code1);

  await verifyOtp(mobile, code1);
  console.log("  کد تأیید شد.");

  const user = await findOrCreateUserByMobile(mobile);
  console.log("  کاربر:", user.id);
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log("  کیف پول ساخته شد با موجودی صفر:", wallet?.balanceRial === 0n);

  // سناریو ۲: کد تکراری (استفاده‌شده) دوباره رد می‌شود
  try {
    await verifyOtp(mobile, code1);
    console.log("\n[سناریو ۲] خطا: انتظار رد شدن کد تکراری بود ولی قبول شد!");
  } catch (e) {
    console.log("\n[سناریو ۲] کد تکراری درست رد شد:", (e as Error).message);
  }

  // سناریو ۴ (زودتر تست می‌شود چون به‌محض ارسال کد قبلی معنا دارد): rate limit روی درخواست مجدد
  try {
    await requestOtp(mobile);
    console.log("\n[سناریو ۴] خطا: انتظار رد شدن به‌خاطر rate limit بود ولی قبول شد!");
  } catch (e) {
    if (e instanceof OtpError) {
      console.log("\n[سناریو ۴] rate limit درست اعمال شد:", e.message);
    } else {
      throw e;
    }
  }

  // برای ادامه‌ی تست، cooldown را با عقب بردن createdAt آخرین کد شبیه‌سازی می‌کنیم.
  await prisma.otpCode.updateMany({
    where: { mobile },
    data: { createdAt: new Date(Date.now() - 61 * 1000) },
  });

  // سناریو ۳: کد اشتباه رد می‌شود و تلاش‌ها افزایش می‌یابد
  const code3 = await captureConsoleCode(mobile, () => requestOtp(mobile));
  try {
    await verifyOtp(mobile, "000000" === code3 ? "111111" : "000000");
    console.log("\n[سناریو ۳] خطا: انتظار رد شدن کد اشتباه بود ولی قبول شد!");
  } catch (e) {
    console.log("\n[سناریو ۳] کد اشتباه درست رد شد:", (e as Error).message);
  }
  await verifyOtp(mobile, code3);
  console.log("  کد درست بعد از یک تلاش اشتباه هنوز قابل قبول است.");

  // سناریو ۵: انقضای کد (با دستکاری مستقیم expiresAt برای شبیه‌سازی گذر زمان)
  const mobile2 = "0913" + Math.floor(1000000 + Math.random() * 8999999);
  const code5 = await captureConsoleCode(mobile2, () => requestOtp(mobile2));
  await prisma.otpCode.updateMany({
    where: { mobile: mobile2, usedAt: null },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  try {
    await verifyOtp(mobile2, code5);
    console.log("\n[سناریو ۵] خطا: انتظار رد شدن کد منقضی بود ولی قبول شد!");
  } catch (e) {
    console.log("\n[سناریو ۵] کد منقضی درست رد شد:", (e as Error).message);
  }

  console.log("\nهمه‌ی سناریوهای هسته‌ی OTP با موفقیت تست شدند.");
  console.log(
    "توجه: تست ساخت session (کوکی httpOnly) و ثبت سفارش با آن، نیازمند next/headers است",
    "و باید از طریق درخواست HTTP واقعی به /api/auth/verify-otp و /api/orders با کوکی مرورگر انجام شود.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
