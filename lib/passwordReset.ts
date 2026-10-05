// بازیابی رمز عبور با پیامک، به دو شکل قابل‌تنظیم: لینک کوتاه و/یا کد ۶ رقمی.
//
// قابل‌تنظیم بودن: حالت از تنظیم PASSWORD_RESET_SMS_MODE خوانده می‌شود (پنل ادمین → env → پیش‌فرض):
//   code → فقط کد (همه‌ی پنل‌ها، از جمله پنل‌های «الگو/کد تأیید» که لینک قبول نمی‌کنند)
//   link → فقط لینک
//   both → یک پیامک شامل هر دو
// هر درخواست همیشه هر دو راز (توکن و کد) را می‌سازد؛ حالت فقط تعیین می‌کند کدام در پیامک برود.
//
// امنیت: توکن ۱۲۸ بیتی و کد ۶ رقمی فقط به‌صورت هش SHA-256 ذخیره می‌شوند، ۱ ساعت اعتبار دارند،
// یک‌بارمصرف‌اند (مصرف با updateMany شرطی، اتمیک)، کد حداکثر ۵ تلاش دارد، و هر درخواست جدید
// درخواست‌های قبلی را باطل می‌کند. پس از بازیابی موفق همه‌ی نشست‌های کاربر باطل می‌شوند.

import crypto from "crypto";
import { prisma } from "./db";
import { getSmsPanel } from "./sms";
import { getSetting } from "./settings";
import { hashPassword } from "./password";

export type ResetMode = "code" | "link" | "both";

const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const DEFAULT_MODE: ResetMode = "code";

export class PasswordResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordResetError";
  }
}

// پیام یکسان برای «کاربر نیست»، «کد غلط»، «منقضی» و «مصرف‌شده» تا اطلاعاتی نشت نکند.
const INVALID_CODE = "کد بازیابی نادرست یا منقضی شده است.";
const INVALID_LINK = "لینک بازیابی نامعتبر، منقضی یا قبلاً استفاده شده است.";

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const hashCode = (userId: string, code: string) => sha256(`reset:${userId}:${code}`);

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * آدرس پایه‌ی لینک فقط از APP_BASE_URL خوانده می‌شود، هرگز از هدر Host درخواست؛ وگرنه مهاجم
 * می‌تواند با Host جعلی کاری کند که لینک بازیابی به دامنه‌ی او پیامک شود (reset poisoning).
 */
function getAppBaseUrl(): string | null {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

export async function getResetMode(): Promise<ResetMode> {
  const raw = ((await getSetting("PASSWORD_RESET_SMS_MODE")) ?? process.env.PASSWORD_RESET_SMS_MODE ?? DEFAULT_MODE)
    .trim()
    .toLowerCase();
  const mode: ResetMode = raw === "link" || raw === "both" || raw === "code" ? raw : DEFAULT_MODE;
  if (mode !== raw) {
    console.error(`[بازیابی رمز] مقدار نامعتبر PASSWORD_RESET_SMS_MODE «${raw}»؛ از «${DEFAULT_MODE}» استفاده شد.`);
  }
  if (mode !== "code" && !getAppBaseUrl()) {
    console.error("[بازیابی رمز] APP_BASE_URL تنظیم نشده؛ لینک ساخته نمی‌شود و فقط کد ارسال می‌شود.");
    return "code";
  }
  return mode;
}

/**
 * اگر کاربری با این موبایل باشد، کد/لینک بازیابی می‌سازد و پیامک می‌کند. برای شماره‌ی ناموجود
 * یا در فاصله‌ی کوتاه از درخواست قبلی بی‌صدا کاری نمی‌کند — پاسخ API در همه‌ی حالت‌ها یکسان است.
 */
export async function requestPasswordReset(mobile: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { mobile }, select: { id: true } });
  if (!user) return;

  const last = await prisma.passwordReset.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS) return;

  const token = crypto.randomBytes(16).toString("base64url");
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

  await prisma.$transaction([
    prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        codeHash: hashCode(user.id, code),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    }),
  ]);

  const mode = await getResetMode();
  const link = `${getAppBaseUrl()}/reset-password?t=${token}`;
  const lines = ["بازیابی رمز گت‌استوک"];
  if (mode !== "link") lines.push(`کد: ${code}`);
  if (mode !== "code") lines.push(link);
  lines.push("اعتبار: ۱ ساعت. اگر شما درخواست نداده‌اید، این پیام را نادیده بگیرید.");

  try {
    const sms = await getSmsPanel();
    // حالت «code» از مسیر پترن می‌رود (خط‌های پترنی متن آزاد را رد می‌کنند)؛ حالت‌های لینک متن ساده‌اند.
    if (mode === "code") await sms.sendResetCode(mobile, code);
    else await sms.sendSms(mobile, lines.join("\n"));
  } catch (error) {
    // پاسخ API باید برای همه‌ی شماره‌ها یکسان بماند (جلوگیری از لو رفتن وجود حساب)؛ پس خطای
    // ارسال فقط لاگ می‌شود و کاربر می‌تواند بعد از فاصله‌ی مجاز دوباره درخواست بدهد.
    console.error("[بازیابی رمز] ارسال پیامک ناموفق بود:", error instanceof Error ? error.message : error);
  }
}

/** با توکن لینک، رمز جدید را تنظیم می‌کند و userId را برمی‌گرداند. */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<string> {
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
    throw new PasswordResetError(INVALID_LINK);
  }
  await applyNewPassword(reset.id, reset.userId, newPassword, INVALID_LINK);
  return reset.userId;
}

/** با موبایل + کد، رمز جدید را تنظیم می‌کند و userId را برمی‌گرداند. */
export async function resetPasswordWithCode(mobile: string, code: string, newPassword: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { mobile }, select: { id: true } });
  const reset = user
    ? await prisma.passwordReset.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: "desc" } })
    : null;
  if (!user || !reset || reset.expiresAt.getTime() < Date.now() || reset.attempts >= MAX_CODE_ATTEMPTS) {
    throw new PasswordResetError(INVALID_CODE);
  }

  if (!safeEqual(hashCode(user.id, code), reset.codeHash)) {
    const attempts = reset.attempts + 1;
    await prisma.passwordReset.update({
      where: { id: reset.id },
      // با رسیدن به سقف تلاش، درخواست باطل می‌شود؛ باید کد جدید گرفت.
      data: { attempts, ...(attempts >= MAX_CODE_ATTEMPTS && { usedAt: new Date() }) },
    });
    throw new PasswordResetError(INVALID_CODE);
  }

  await applyNewPassword(reset.id, user.id, newPassword, INVALID_CODE);
  return user.id;
}

async function applyNewPassword(resetId: string, userId: string, newPassword: string, invalidMessage: string) {
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    // مصرف اتمیک: اگر دو درخواست هم‌زمان با یک توکن/کد برسند، فقط یکی count=1 می‌گیرد.
    const consumed = await tx.passwordReset.updateMany({
      where: { id: resetId, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new PasswordResetError(invalidMessage);
    }
    await tx.user.update({ where: { id: userId }, data: { passwordHash, passwordUpdatedAt: new Date() } });
    await tx.session.deleteMany({ where: { userId } });
  });
}
