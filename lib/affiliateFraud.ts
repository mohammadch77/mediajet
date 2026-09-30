// تشخیص خودکار تقلب در همکاری در فروش.
//
// هشدارها فقط «هشدار» هستند: چیزی را خودکار مسدود نمی‌کنند، چون IP در ایران (NAT اپراتورهای موبایل،
// VPN، شبکه‌ی اداری) زیاد مشترک است و مثبت کاذب دارد. تصمیم با ادمین است (بررسی، تعلیق یا رد تسویه).
// هر هشدار یک‌بار ساخته می‌شود (dedupeKey یکتا) و به چت مالی تلگرام اعلام می‌شود.
//
// نشانه‌ها:
//   same_ip      زیرمجموعه از همان IP ثبت‌نام کرده که همکار با آن ثبت‌نام/وارد شده (احتمال حساب دوم خودش)
//   ip_burst     چند زیرمجموعه‌ی یک همکار در ۲۴ ساعت از یک IP (ساخت انبوه حساب)
//   shared_card  کارت درخواست تسویه قبلاً برای همکار دیگری استفاده شده (چند حساب همکاری، یک نفر)

import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getPaymentSettings } from "./paymentSettings";
import { getTelegramConfig, sendMessage } from "./telegram";

const UNKNOWN_IP = "unknown";
const UNIQUE_VIOLATION = "P2002";

export const FRAUD_KIND_LABELS: Record<string, string> = {
  same_ip: "IP مشترک با همکار",
  ip_burst: "ثبت‌نام انبوه از یک IP",
  shared_card: "کارت مشترک با همکار دیگر",
};

async function raiseFlag(affiliateId: string, kind: keyof typeof FRAUD_KIND_LABELS, detail: string, dedupeKey: string) {
  try {
    await prisma.affiliateFraudFlag.create({ data: { affiliateId, kind, detail, dedupeKey } });
  } catch (error) {
    // همین رویداد قبلاً هشدار ساخته؛ هشدار تکراری لازم نیست.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) return;
    throw error;
  }
  void alertTelegram(affiliateId, kind, detail);
}

async function alertTelegram(affiliateId: string, kind: string, detail: string): Promise<void> {
  try {
    const chatId = await getTelegramConfig("TELEGRAM_CHAT_FINANCE");
    if (!chatId) return;
    const u = await prisma.user.findUnique({ where: { id: affiliateId }, select: { mobile: true, referralCode: true } });
    await sendMessage(
      chatId,
      [
        "🚨 هشدار تقلب همکاری در فروش",
        `همکار: ${u?.mobile ?? affiliateId} (${u?.referralCode ?? "—"})`,
        `نوع: ${FRAUD_KIND_LABELS[kind] ?? kind}`,
        detail,
        "بررسی: پنل ادمین ← همکاری در فروش ← هشدارها",
      ].join("\n"),
    );
  } catch (error) {
    console.error("[تلگرام خطا] اطلاع هشدار تقلب ناموفق بود:", error);
  }
}

/**
 * بعد از ساخت کاربرِ زیرمجموعه صدا زده می‌شود. هرگز ثبت‌نام را fail نمی‌کند.
 */
export async function checkReferralSignup(referralId: string): Promise<void> {
  try {
    const referral = await prisma.user.findUnique({
      where: { id: referralId },
      select: { id: true, mobile: true, signupIp: true, referredById: true },
    });
    if (!referral?.referredById || !referral.signupIp || referral.signupIp === UNKNOWN_IP) return;
    const affiliate = await prisma.user.findUnique({
      where: { id: referral.referredById },
      select: { id: true, signupIp: true, lastLoginIp: true },
    });
    if (!affiliate) return;

    const ip = referral.signupIp;
    if (ip === affiliate.signupIp || ip === affiliate.lastLoginIp) {
      await raiseFlag(
        affiliate.id,
        "same_ip",
        `زیرمجموعه ${referral.mobile} از همان IP همکار (${ip}) ثبت‌نام کرد.`,
        `same_ip:${referral.id}`,
      );
    }

    const { affiliateFraudIpBurst } = await getPaymentSettings();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const burst = await prisma.user.count({
      where: { referredById: affiliate.id, signupIp: ip, createdAt: { gte: since } },
    });
    if (burst >= affiliateFraudIpBurst) {
      const day = new Date().toISOString().slice(0, 10);
      await raiseFlag(
        affiliate.id,
        "ip_burst",
        `${burst} زیرمجموعه در ۲۴ ساعت گذشته از IP ${ip} ثبت‌نام کردند.`,
        `ip_burst:${affiliate.id}:${ip}:${day}`,
      );
    }
  } catch (error) {
    console.error("[همکاری] بررسی تقلب ثبت‌نام ناموفق بود:", error);
  }
}

/** بعد از ثبت درخواست تسویه صدا زده می‌شود. هرگز درخواست را fail نمی‌کند. */
export async function checkPayoutCard(payoutId: string): Promise<void> {
  try {
    const payout = await prisma.affiliatePayout.findUnique({ where: { id: payoutId } });
    if (!payout) return;
    const others = await prisma.affiliatePayout.findMany({
      where: { cardNumber: payout.cardNumber, userId: { not: payout.userId } },
      distinct: ["userId"],
      select: { user: { select: { mobile: true } } },
    });
    if (others.length === 0) return;
    await raiseFlag(
      payout.userId,
      "shared_card",
      `کارت ${payout.cardNumber.slice(0, 4)}…${payout.cardNumber.slice(-4)} قبلاً برای همکار(ان) ${others.map((o) => o.user.mobile).join("، ")} استفاده شده است.`,
      `shared_card:${payout.userId}:${payout.cardNumber}`,
    );
  } catch (error) {
    console.error("[همکاری] بررسی کارت تسویه ناموفق بود:", error);
  }
}

/** بستن هشدار توسط ادمین با نتیجه‌ی بررسی. */
export async function resolveFraudFlag(adminId: string, flagId: string, resolution: string): Promise<boolean> {
  const updated = await prisma.affiliateFraudFlag.updateMany({
    where: { id: flagId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedById: adminId, resolution },
  });
  return updated.count === 1;
}
