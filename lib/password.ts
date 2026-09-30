// هش و بررسی رمز عبور با bcrypt. رمز خام هرگز ذخیره یا لاگ نمی‌شود.

import bcrypt from "bcryptjs";
import { prisma } from "./db";

const BCRYPT_COST = 12;

// هش ثابت برای وقتی ایمیل وجود ندارد: bcrypt.compare روی آن اجرا می‌شود تا زمان پاسخ
// «ایمیل ناموجود» و «رمز نادرست» یکسان باشد و از روی زمان نتوان حساب‌ها را کشف کرد.
const DUMMY_HASH = bcrypt.hashSync("mediajet-dummy-password-for-timing", BCRYPT_COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** کاربر را با ایمیل/رمز پیدا می‌کند؛ در هر حالت ناموفق null (بدون تمایز بین دلیل‌ها). */
export async function verifyEmailPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  return ok && user?.passwordHash ? user : null;
}

export function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
