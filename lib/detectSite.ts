import { detectSiteFromInput } from "./productUrl";

/** تشخیص نام سایت از روی لینک محصول (فقط بر اساس نام دامنه). اگر شناسایی نشد، رشته‌ی خالی. */
export function detectSite(url: string): string {
  return detectSiteFromInput(url);
}
