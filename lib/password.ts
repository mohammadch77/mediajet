// هش و بررسی رمز عبور با bcrypt. رمز خام هرگز ذخیره یا لاگ نمی‌شود.

import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "./db";

const BCRYPT_COST = 12;

// هش ثابت برای وقتی ایمیل وجود ندارد: bcrypt.compare روی آن اجرا می‌شود تا زمان پاسخ
// «ایمیل ناموجود» و «رمز نادرست» یکسان باشد و از روی زمان نتوان حساب‌ها را کشف کرد.
const DUMMY_HASH = bcrypt.hashSync("mediajet-dummy-password-for-timing", BCRYPT_COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export type EmailLoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "not_found" | "no_password" | "wrong_password" | "disabled" };

/** ورود با ایمیل/رمز؛ دلیل شکست صریح برگردانده می‌شود (تصمیم محصول؛ سقف نرخ در مسیر login اعمال است). */
export async function verifyEmailPassword(email: string, password: string): Promise<EmailLoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH); // زمان پاسخ ناموجود با بقیه نزدیک بماند
    return { ok: false, reason: "not_found" };
  }
  if (!user.passwordHash) return { ok: false, reason: "no_password" };
  if (!(await bcrypt.compare(password, user.passwordHash))) return { ok: false, reason: "wrong_password" };
  if (user.disabledAt) return { ok: false, reason: "disabled" };
  return { ok: true, user };
}

export function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
