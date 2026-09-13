// مدیریت نشست ورود کاربر با کوکی httpOnly.
// توکن خام فقط داخل کوکی کلاینت است؛ در دیتابیس فقط هش SHA-256 آن نگه‌داری می‌شود
// تا لو رفتن دیتابیس به معنای لو رفتن نشست‌های فعال نباشد.

import crypto from "crypto";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";

const SESSION_COOKIE = "mediajet_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ۳۰ روز

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** برای موبایل داده‌شده، در صورت نبود کاربر می‌سازد (به‌همراه کیف پول با موجودی صفر). */
export async function findOrCreateUserByMobile(mobile: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: { mobile, wallet: { create: { balanceRial: 0n } } },
  });
}

/** نشست جدید می‌سازد و توکن خام را در کوکی httpOnly می‌گذارد. */
export async function createSession(userId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

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
