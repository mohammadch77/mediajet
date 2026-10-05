// بررسی وضعیت حساب پیش از ورود/ثبت‌نام با موبایل. پیام‌ها عمداً صریح‌اند (تصمیم محصول)،
// و سقف نرخ مسیرهای OTP/ورود جلوی سوءاستفاده برای کشف شماره‌ها را می‌گیرد.

import { prisma } from "./db";
import { DISABLED_ACCOUNT_MESSAGE } from "./session";

export type OtpPurpose = "login" | "signup";

export class AccountError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 404 | 409,
  ) {
    super(message);
    this.name = "AccountError";
  }
}

/**
 * login: حساب باید وجود داشته باشد و فعال باشد.
 * signup: شماره نباید قبلاً ثبت شده باشد.
 * (قبل از ارسال پیامک اجرا می‌شود تا برای شماره‌ی نامعتبر هزینه‌ی پیامک نشود.)
 */
export async function assertMobileEligible(mobile: string, purpose: OtpPurpose): Promise<void> {
  const user = await prisma.user.findUnique({ where: { mobile }, select: { disabledAt: true } });

  if (purpose === "signup") {
    if (user) throw new AccountError("این شماره قبلاً ثبت‌نام کرده است. وارد شوید.", 409);
    return;
  }
  if (!user) throw new AccountError("حسابی با این شماره وجود ندارد. ابتدا ثبت‌نام کنید.", 404);
  if (user.disabledAt) throw new AccountError(DISABLED_ACCOUNT_MESSAGE, 403);
}
