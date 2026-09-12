import { SITE_KEYS } from "@/data/categories";

/** تشخیص نام سایت از روی لینک محصول. اگر شناسایی نشد، رشته‌ی خالی برمی‌گرداند. */
export function detectSite(url: string): string {
  const low = url.toLowerCase();
  for (const key in SITE_KEYS) {
    if (low.includes(key)) return SITE_KEYS[key];
  }
  return "";
}
