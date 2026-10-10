// مدیریت نشست ورود کاربر با کوکی httpOnly.
// توکن خام فقط داخل کوکی کلاینت است؛ در دیتابیس فقط هش SHA-256 آن نگه‌داری می‌شود
// تا لو رفتن دیتابیس به معنای لو رفتن نشست‌های فعال نباشد.

import crypto from "crypto";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { checkReferralSignup } from "./affiliateFraud";
import { REF_COOKIE, findAffiliateIdByCode, normalizeReferralCode, notifyNewReferral } from "./affiliate";

const SESSION_COOKIE = "mediajet_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ۳۰ روز

export const DISABLED_ACCOUNT_MESSAGE = "حساب شما توسط مدیر غیرفعال شده است. برای پیگیری با پشتیبانی تماس بگیرید.";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** برای موبایل داده‌شده، در صورت نبود کاربر می‌سازد (به‌همراه کیف پول با موجودی صفر). */
export async function findOrCreateUserByMobile(
  mobile: string,
  ip?: string,
  terms?: { acceptedAt: Date; version: string },
): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) {
    // کاربر موجودی که کیف پول ندارد (مثلاً ادمین ساخته‌شده با اسکریپت) در اولین ورود کیف پول می‌گیرد.
    await prisma.wallet.upsert({
      where: { userId: existing.id },
      create: { userId: existing.id, balanceRial: 0n },
      update: {},
    });
    return existing;
  }

  // کاربر جدیدی که از لینک ?ref= آمده، برای همیشه زیرمجموعه‌ی همان همکار می‌شود.
  // فقط همین لحظه (ساخت کاربر) خوانده می‌شود؛ کاربر موجود هرگز معرفش عوض نمی‌شود.
  const store = await cookies();
  const referredById = await findAffiliateIdByCode(normalizeReferralCode(store.get(REF_COOKIE)?.value));

  const user = await prisma.user.create({
    data: {
      mobile,
      signupIp: ip ?? null,
      ...(terms && { termsAcceptedAt: terms.acceptedAt, termsVersion: terms.version }),
      ...(referredById && { referredById }),
      wallet: { create: { balanceRial: 0n } },
    },
  });
  if (referredById) {
    await notifyNewReferral(referredById);
    void checkReferralSignup(user.id);
  }
  return user;
}

/** نشست جدید می‌سازد و توکن خام را در کوکی httpOnly می‌گذارد. */
export async function createSession(userId: string, ip?: string): Promise<void> {
  // آخرین خط دفاع: مسیرهای ورود خودشان وضعیت را چک می‌کنند، ولی نشست برای کاربر غیرفعال هرگز ساخته نمی‌شود.
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  if (!target || target.disabledAt) throw new SessionError(DISABLED_ACCOUNT_MESSAGE);

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });
  // آخرین IP ورود، برای تشخیص تقلب همکاری (زیرمجموعه‌ای که از IP خود همکار ثبت‌نام کند).
  if (ip) await prisma.user.update({ where: { id: userId }, data: { lastLoginIp: ip } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** کاربر جاری را از روی کوکی نشست برمی‌گرداند؛ اگر نشست نبود یا منقضی بود، null. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  // کاربر غیرفعال‌شده حتی با نشست معتبر قدیمی (کوکی باقی‌مانده) هیچ دسترسی ندارد.
  if (session.user.disabledAt) {
    return null;
  }

  return session.user;
}

/** نشست جاری را باطل می‌کند و کوکی را پاک می‌کند. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }

  store.delete(SESSION_COOKIE);
}

/** همه‌ی نشست‌های کاربر به‌جز نشست جاری (همین مرورگر) را باطل می‌کند؛ بعد از تغییر رمز. */
export async function revokeOtherSessions(userId: string): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  await prisma.session.deleteMany({
    where: { userId, ...(token && { tokenHash: { not: hashToken(token) } }) },
  });
}

/** برای مسیرهای محافظت‌شده: کاربر جاری را برمی‌گرداند یا خطا پرتاب می‌کند. */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new SessionError("برای انجام این عملیات باید وارد شوید.");
  }
  return user;
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

/** برای مسیرهای پنل اپراتور: کاربر جاری را برمی‌گرداند، فقط اگر نقش operator داشته باشد. */
export async function requireOperator(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== "operator") {
    throw new SessionError("این عملیات فقط برای اپراتور مجاز است.");
  }
  return user;
}

/** برای مسیرهای پنل ادمین: کاربر جاری را برمی‌گرداند، فقط اگر نقش admin داشته باشد. operator و user رد می‌شوند. */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new SessionError("این عملیات فقط برای مدیر سیستم مجاز است.");
  }
  return user;
}
