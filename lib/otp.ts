// احراز هویت با موبایل + OTP.
// ارسال از طریق lib/sms.ts؛ تا وقتی کلید پنل پیامک تنظیم نشده، کد در کنسول سرور چاپ می‌شود.
// اصول امنیتی: کد هرگز خام ذخیره نمی‌شود (فقط هش)، محدودیت تلاش، انقضا، rate limit روی ارسال مجدد.

import crypto from "crypto";
import { prisma } from "./db";
import { getSmsPanel } from "./sms";

export class OtpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OtpError";
  }
}

const CODE_LENGTH = 6;
const CODE_TTL_MS = 2 * 60 * 1000; // ۲ دقیقه
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // هر شماره هر ۶۰ ثانیه یک‌بار

function hashCode(mobile: string, code: string): string {
  return crypto.createHash("sha256").update(`${mobile}:${code}`).digest("hex");
}

function generateCode(): string {
  const max = 10 ** CODE_LENGTH;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(CODE_LENGTH, "0");
}

/** کد OTP می‌سازد، هش‌شده ذخیره می‌کند و (در حالت شبیه‌سازی) در کنسول چاپ می‌کند. */
export async function requestOtp(mobile: string): Promise<void> {
  const lastSent = await prisma.otpCode.findFirst({
    where: { mobile },
    orderBy: { createdAt: "desc" },
  });

  if (lastSent && Date.now() - lastSent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - lastSent.createdAt.getTime())) / 1000,
    );
    throw new OtpError(`لطفاً ${waitSeconds} ثانیه دیگر دوباره تلاش کنید.`);
  }

  const code = generateCode();
  const codeHash = hashCode(mobile, code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  const [, created] = await prisma.$transaction([
    // ابطال کدهای قبلیِ استفاده‌نشده‌ی این شماره؛ فقط آخرین کد معتبر است.
    prisma.otpCode.updateMany({
      where: { mobile, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.otpCode.create({
      data: { mobile, codeHash, expiresAt },
    }),
  ]);

  try {
    const smsPanel = await getSmsPanel();
    await smsPanel.sendSms(mobile, `کد ورود گت‌استوک: ${code}`);
  } catch (error) {
    // کدی که هرگز به دست کاربر نرسیده نباید فاصله‌ی ۶۰ ثانیه‌ای را فعال نگه دارد؛ کاربر باید بتواند دوباره تلاش کند.
    await prisma.otpCode.delete({ where: { id: created.id } }).catch(() => {});
    throw error;
  }
}

/** کد OTP را تأیید می‌کند. در صورت موفقیت، کد را used می‌کند تا دوباره قابل استفاده نباشد. */
export async function verifyOtp(mobile: string, code: string): Promise<void> {
  const otp = await prisma.otpCode.findFirst({
    where: { mobile, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw new OtpError("کد معتبری برای این شماره یافت نشد.");
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    throw new OtpError("کد منقضی شده است. کد جدید درخواست کنید.");
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new OtpError("تعداد تلاش‌های مجاز برای این کد تمام شده است.");
  }

  const codeHash = hashCode(mobile, code);

  if (codeHash !== otp.codeHash) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new OtpError("کد وارد شده نادرست است.");
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { usedAt: new Date() },
  });
}
