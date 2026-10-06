// تعدیل دستی کیف پول توسط ادمین (افزایش/کاهش با دلیل). از همان creditWallet/debitWallet استفاده
// می‌کند تا قفل ردیف، idempotency و جلوگیری از موجودی منفی دقیقاً مثل بقیه‌ی مسیرهای مالی باشد.
// هر تعدیل یک WalletTransaction تغییرناپذیر است؛ ref=admin:<id> و note شامل دلیل، ردّ حسابرسی است.

import { prisma } from "./db";
import { creditWallet, debitWallet, ensureWallet, WalletError } from "./wallet";

export const ADMIN_REF_PREFIX = "admin:";

export async function adjustWalletByAdmin(params: {
  adminId: string;
  userId: string;
  direction: "credit" | "debit";
  amountRial: bigint;
  reason: string;
  idempotencyKey: string;
}) {
  const { adminId, userId, direction, amountRial, reason, idempotencyKey } = params;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    throw new WalletError("کاربر پیدا نشد.");
  }
  // کاربرانی که کیف پول ندارند (مثلاً ساخته‌شده با اسکریپت) با موجودی صفر ساخته می‌شوند.
  await ensureWallet(userId);

  const ref = `${ADMIN_REF_PREFIX}${adminId}`;
  const note = `${direction === "credit" ? "افزایش" : "کاهش"} دستی توسط ادمین: ${reason}`;
  // کلید به کاربر گره می‌خورد تا یک کلید تکراری هرگز روی کیف پول دیگری اثر نگذارد.
  const key = `admin-adjust:${userId}:${idempotencyKey}`;

  return direction === "credit"
    ? creditWallet(userId, amountRial, ref, note, key)
    : debitWallet(userId, amountRial, ref, note, key);
}
