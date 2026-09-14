// لایه‌ی انتزاعی پنل پیامک. منطق بالادست (ارسال OTP) فقط با این اینترفیس کار می‌کند
// تا جایگزینی MockSmsPanel با پیاده‌سازی واقعی بدون تغییر در بقیه‌ی کد ممکن باشد.

import { getSetting } from "./settings";

export interface SmsPanel {
  /** یک پیامک متنی به شماره‌ی داده‌شده ارسال می‌کند. */
  sendSms(mobile: string, text: string): Promise<void>;
}

/** پیاده‌سازی شبیه‌سازی‌شده: به‌جای ارسال واقعی، پیام را در کنسول سرور چاپ می‌کند. */
class MockSmsPanel implements SmsPanel {
  async sendSms(mobile: string, text: string): Promise<void> {
    console.log(`[پیامک شبیه‌سازی] موبایل ${mobile} → ${text}`);
  }
}

/**
 * انتخاب پیاده‌سازی پنل پیامک فعال. کلید API از تنظیمات رمزنگاری‌شده (getSetting)
 * خوانده می‌شود، نه از env مستقیم — تا از پنل ادمین (/admin/settings) قابل تغییر باشد.
 * وقتی کلید واقعی تنظیم شد، به‌جای MockSmsPanel یک پیاده‌سازی واقعی (مثلاً کاوه‌نگار/ملی‌پیامک)
 * که همین SmsPanel را با آن کلید پیاده‌سازی می‌کند برگردان؛ بقیه‌ی کد دست‌نخورده می‌ماند.
 */
export async function getSmsPanel(): Promise<SmsPanel> {
  const apiKey = await getSetting("SMS_PANEL_API_KEY");
  void apiKey; // TODO: وقتی پیاده‌سازی واقعی اضافه شد، این مقدار به آن پاس داده می‌شود.
  return new MockSmsPanel();
}
