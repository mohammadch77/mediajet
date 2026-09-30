import type { User } from "@prisma/client";
import { prisma } from "./db";

/** شکل واحد کاربر در پاسخ همه‌ی مسیرهای احراز هویت (me، ورود، OTP، بازیابی). هش رمز هرگز بیرون نمی‌رود. */
export async function authUserPayload(user: User) {
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return {
    id: user.id,
    mobile: user.mobile,
    name: user.name,
    email: user.email,
    hasPassword: user.passwordHash !== null,
    role: user.role,
    walletBalanceRial: (wallet?.balanceRial ?? 0n).toString(),
  };
}
