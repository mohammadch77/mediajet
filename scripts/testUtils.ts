// ابزار مشترک اسکریپت‌های تست HTTP (نیازمند اجرای سرور dev؛ BASE_URL قابل تنظیم).
// - check(): ثبت pass/fail هر گام؛ finish() در پایان خلاصه چاپ می‌کند و در صورت شکست exit code غیرصفر می‌دهد.
// - makeSessionCookie(): session مستقیم در دیتابیس با همان هش‌سازی lib/session.ts (به‌جای جریان OTP کامل).
// - withTelegramTestConfig(): چت اپراتور/secret وب‌هوک را موقتاً در تنظیمات دیتابیس (که بر env سرور مقدم است)
//   ست می‌کند تا سرور dev همان مقداری را ببیند که تست ارسال می‌کند؛ در پایان مقدار قبلی بازگردانده می‌شود.

import crypto from "crypto";
import fs from "fs";

// اسکریپت‌ها با tsx اجرا می‌شوند و .env را خودکار نمی‌خوانند (ENCRYPTION_KEY برای setSetting لازم است).
if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

import { prisma } from "../lib/db";
import { setSetting, type SettingKey } from "../lib/settings";

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "mediajet_session";

let passed = 0;
const failures: string[] = [];
let skipped = 0;

export function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ❌ ${label}`, detail === undefined ? "" : detail);
  }
}

export function skip(label: string, reason: string): void {
  skipped++;
  console.log(`  ⏭️  ${label} — رد شد: ${reason}`);
}

/** خلاصه‌ی نتایج؛ در صورت هر شکست exit code = 1. */
export function finish(): void {
  console.log(`\nنتیجه: ${passed} موفق، ${failures.length} ناموفق، ${skipped} ردشده`);
  if (failures.length) {
    console.log("گام‌های ناموفق:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exitCode = 1;
  }
}

/** اجرای main با مدیریت خطا، چاپ خلاصه و قطع اتصال دیتابیس. */
export function run(main: () => Promise<void>): void {
  main()
    .catch((e) => {
      console.error(e);
      failures.push(`خطای پیش‌بینی‌نشده: ${e instanceof Error ? e.message : String(e)}`);
    })
    .finally(async () => {
      finish();
      await prisma.$disconnect();
    });
}

export async function makeSessionCookie(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      userId,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return `${SESSION_COOKIE}=${token}`;
}

export function randomMobile(prefix: string): string {
  return prefix + Math.floor(1000000 + Math.random() * 8999999);
}

/** پاسخ JSON؛ اگر سرور HTML (مثلاً صفحه‌ی ۴۰۴) برگرداند، به‌جای crash مقدار null. */
export async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type TelegramTestConfig = {
  operatorChatId: string;
  /** هدرهای لازم برای POST به وب‌هوک (شامل secret token). */
  webhookHeaders: Record<string, string>;
  /**
   * آیا توکن واقعی ربات تنظیم است؟ در این صورت downloadTelegramFile به API تلگرام درخواست می‌زند
   * و file_id جعلی تست شکست می‌خورد (یا در sandbox بدون شبکه اصلاً در دسترس نیست)؛ گام‌های وابسته
   * به دانلود فایل باید skip شوند. بدون توکن، دانلود شبیه‌سازی می‌شود.
   */
  hasRealBotToken: boolean;
};

const TEST_CONFIG_KEYS = ["TELEGRAM_CHAT_OPERATOR", "TELEGRAM_WEBHOOK_SECRET"] as const satisfies readonly SettingKey[];

export async function withTelegramTestConfig(
  operatorChatId: string,
  body: (config: TelegramTestConfig) => Promise<void>,
): Promise<void> {
  const previous = await prisma.appSetting.findMany({ where: { key: { in: [...TEST_CONFIG_KEYS] } } });
  const secret = crypto.randomBytes(16).toString("hex");
  await setSetting("TELEGRAM_CHAT_OPERATOR", operatorChatId, "test-script");
  await setSetting("TELEGRAM_WEBHOOK_SECRET", secret, "test-script");

  const tokenRow = await prisma.appSetting.findUnique({ where: { key: "TELEGRAM_BOT_TOKEN" } });
  const hasRealBotToken = Boolean(tokenRow || process.env.TELEGRAM_BOT_TOKEN);

  try {
    await body({
      operatorChatId,
      webhookHeaders: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
      hasRealBotToken,
    });
  } finally {
    await prisma.appSetting.deleteMany({ where: { key: { in: [...TEST_CONFIG_KEYS] } } });
    for (const row of previous) {
      await prisma.appSetting.create({ data: row });
    }
  }
}

export function postWebhook(config: TelegramTestConfig, message: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE_URL}/api/telegram/webhook`, {
    method: "POST",
    headers: config.webhookHeaders,
    body: JSON.stringify({ message }),
  });
}
