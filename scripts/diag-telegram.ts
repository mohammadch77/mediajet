// عیب‌یابی تنظیمات تلگرام: منبع هر مقدار (DB/env) و وضعیت webhook از دید تلگرام. توکن/secret چاپ نمی‌شوند.
// اجرا: npx tsx --env-file=.env scripts/diag-telegram.ts
import { getSetting } from "../lib/settings";
import { getTelegramConfig, telegramFetch } from "../lib/telegram";
import { prisma } from "../lib/db";

const KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_FINANCE",
  "TELEGRAM_CHAT_OPERATOR",
  "TELEGRAM_CHAT_SUPPORT",
  "TELEGRAM_WEBHOOK_SECRET",
  "TELEGRAM_API_BASE",
  "TELEGRAM_RELAY_SECRET",
] as const;
const SECRET_KEYS = new Set(["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_RELAY_SECRET"]);

async function main() {
  for (const key of KEYS) {
    const fromDb = await getSetting(key);
    const effective = await getTelegramConfig(key);
    const source = fromDb ? "DB (پنل ادمین)" : process.env[key] ? ".env" : "تنظیم نشده";
    const shown = SECRET_KEYS.has(key) ? (effective ? `***${effective.slice(-4)}` : "-") : effective ?? "-";
    const differs = fromDb && process.env[key] && fromDb !== process.env[key] ? "  ⚠️ با .env فرق دارد" : "";
    console.log(`${key}: ${shown}  [منبع: ${source}]${differs}`);
  }

  const token = await getTelegramConfig("TELEGRAM_BOT_TOKEN");
  if (token) {
    const res = await telegramFetch(token, "/getWebhookInfo");
    const info = await res.json();
    const r = info.result ?? {};
    console.log("\nwebhook:", {
      ok: info.ok,
      url: r.url,
      pending_update_count: r.pending_update_count,
      last_error_date: r.last_error_date ? new Date(r.last_error_date * 1000).toISOString() : undefined,
      last_error_message: r.last_error_message,
      allowed_updates: r.allowed_updates,
    });
  }
  await prisma.$disconnect();
}

main();
