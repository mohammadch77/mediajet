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
const CODE_TTL_MS = 5 * 60 * 1000; // ۵ دقیقه (پیامک ممکن است با تأخیر برسد)
const MAX_ACTIVE_CODES = 3; // حداکثر چند کد اخیرِ منقضی‌نشده هم‌زمان معتبرند
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

  // کدهای قبلیِ منقضی‌نشده باطل نمی‌شوند: اگر پیامک قبلی با تأخیر برسد و کاربر در همین فاصله
  // «ارسال مجدد» زده باشد، کد قدیمی هنوز معتبر است (verifyOtp فقط چند کد اخیر را می‌پذیرد).
  const created = await prisma.otpCode.create({
    data: { mobile, codeHash, expiresAt },
  });

  try {
    const smsPanel = await getSmsPanel();
    await smsPanel.sendOtp(mobile, code);
  } catch (error) {
    // کدی که هرگز به دست کاربر نرسیده نباید فاصله‌ی ۶۰ ثانیه‌ای را فعال نگه دارد؛ کاربر باید بتواند دوباره تلاش کند.
    await prisma.otpCode.delete({ where: { id: created.id } }).catch(() => {});
    throw error;
  }
}

/**
 * کد OTP را تأیید می‌کند. تا MAX_ACTIVE_CODES کد اخیرِ منقضی‌نشده پذیرفته می‌شود (پیامک دیررسیده)؛
 * هر حدس نادرست از سقف تلاش همه‌ی آن‌ها کم می‌کند. در موفقیت، همه‌ی کدهای باز این شماره used می‌شوند.
 */
export async function verifyOtp(mobile: string, code: string): Promise<void> {
  const candidates = await prisma.otpCode.findMany({
    where: { mobile, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: MAX_ACTIVE_CODES,
  });

  if (candidates.length === 0) {
    const anyUnused = await prisma.otpCode.findFirst({ where: { mobile, usedAt: null } });
    throw new OtpError(
      anyUnused ? "کد منقضی شده است. کد جدید درخواست کنید." : "کد معتبری برای این شماره یافت نشد.",
    );
  }

  const open = candidates.filter((c) => c.attempts < MAX_ATTEMPTS);
  if (open.length === 0) {
    throw new OtpError("تعداد تلاش‌های مجاز برای این کد تمام شده است.");
  }

  const codeHash = hashCode(mobile, code);
  const match = open.find((c) => c.codeHash === codeHash);

  if (!match) {
    await prisma.otpCode.updateMany({
      where: { id: { in: open.map((c) => c.id) } },
      data: { attempts: { increment: 1 } },
    });
    throw new OtpError("کد وارد شده نادرست است.");
  }

  await prisma.otpCode.updateMany({
    where: { mobile, usedAt: null },
    data: { usedAt: new Date() },
  });
}
