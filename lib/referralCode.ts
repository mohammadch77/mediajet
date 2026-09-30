// ثابت‌ها و توابع خالص کد معرف. بدون وابستگی به prisma تا middleware (edge) هم بتواند import کند.

/** نام کوکی که کد معرف را از لحظه‌ی کلیک تا ثبت‌نام نگه می‌دارد. */
export const REF_COOKIE = "mj_ref";
export const REF_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // ۳۰ روز

const CODE_PATTERN = /^[A-Z0-9]{5,12}$/;

/** کد ورودی (از URL یا کوکی) را یکدست می‌کند؛ اگر شکلش نامعتبر بود null. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}
