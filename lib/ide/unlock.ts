// «بازکردن قفل» ابزار توسعه: بعد از وارد کردن مجدد رمز ادمین، یک کوکی امضاشده‌ی کوتاه‌مدت داده می‌شود.
// ورود با session به‌تنهایی کافی نیست؛ اگر نشست ادمین لو برود، مهاجم بدون رمز به کد دسترسی ندارد.

import crypto from "crypto";

export const IDE_UNLOCK_COOKIE = "ide_unlock";
export const IDE_UNLOCK_TTL_MS = 20 * 60 * 1000;

function sign(payload: string): string {
  const master = process.env.ENCRYPTION_KEY;
  if (!master) throw new Error("ENCRYPTION_KEY تنظیم نشده است.");
  // کلید مشتق‌شده، تا همان کلید اصلی مستقیم برای امضا استفاده نشود.
  const key = crypto.createHmac("sha256", master).update("ide-unlock-v1").digest();
  return crypto.createHmac("sha256", key).update(payload).digest("hex");
}

export function createUnlockToken(adminId: string, now = Date.now()): string {
  const payload = `${adminId}.${now + IDE_UNLOCK_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyUnlockToken(token: string | undefined, adminId: string, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, expires, signature] = parts;
  if (id !== adminId || !/^\d+$/.test(expires) || Number(expires) <= now) return false;

  const expected = Buffer.from(sign(`${id}.${expires}`), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
