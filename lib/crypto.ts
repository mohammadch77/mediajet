// رمزنگاری/رمزگشایی متقارن برای مقادیر حساس (کلیدهای API و مشابه) قبل از ذخیره در دیتابیس.
//
// چرا AES-256-GCM: یک الگوریتم رمزنگاری احرازشده (authenticated encryption) است —
// هم محرمانگی و هم صحت داده را تضمین می‌کند؛ یعنی اگر کسی متن رمزشده در دیتابیس را
// دستکاری کند، رمزگشایی با خطا شکست می‌خورد (به‌خاطر auth tag) نه اینکه مقدار خرابیده
// را بی‌صدا برگرداند. برای هر رمزنگاری یک IV تصادفی جدید تولید می‌شود تا رمزنگاری
// یک مقدار تکراری، خروجی یکسان تولید نکند (semantic security).
//
// کلید اصلی از ENCRYPTION_KEY (متغیر محیطی، هرگز در گیت) خوانده می‌شود؛ اگر لو برود
// یا دیتابیس به‌تنهایی لو برود، بدون کلید محیطی مقادیر رمزشده غیرقابل بازیابی‌اند.

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // طول توصیه‌شده برای GCM
const KEY_LENGTH = 32; // AES-256

let cachedKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY تنظیم نشده است. یک کلید ۳۲ بایتی (۶۴ کاراکتر hex) در .env تنظیم کنید.",
    );
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY باید دقیقاً ${KEY_LENGTH} بایت (${KEY_LENGTH * 2} کاراکتر hex) باشد.`,
    );
  }

  cachedKey = key;
  return cachedKey;
}

/** مقدار متنی را رمزنگاری می‌کند. خروجی: "iv:authTag:ciphertext" (همه hex) برای ذخیره در دیتابیس. */
export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** مقدار رمزشده با encryptSecret را برمی‌گرداند؛ اگر دستکاری یا کلید اشتباه بود، خطا می‌دهد. */
export function decryptSecret(payload: string): string {
  const key = getMasterKey();
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("قالب مقدار رمزشده نامعتبر است.");
  }

  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
