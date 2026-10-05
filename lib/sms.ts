// لایه‌ی انتزاعی پنل پیامک. منطق بالادست (ارسال OTP و بازیابی رمز) فقط با این اینترفیس کار می‌کند
// تا جایگزینی پیاده‌سازی بدون تغییر در بقیه‌ی کد ممکن باشد.
//
// پیاده‌سازی واقعی: ایران‌پیامک (docs.iranpayamak.com) — ارسال ساده POST /ws/v1/sms/simple
// با هدر Api-Key. کلید API و شماره‌ی خط از تنظیمات رمزنگاری‌شده (/admin/settings) خوانده می‌شوند.

import { getSetting } from "./settings";

export interface SmsPanel {
  /** یک پیامک متنی به شماره‌ی داده‌شده ارسال می‌کند؛ در صورت شکست SmsError پرتاب می‌کند. */
  sendSms(mobile: string, text: string): Promise<void>;
  /** کد تأیید (OTP) را می‌فرستد؛ اگر پترن تنظیم شده باشد از مسیر پیامک الگویی، وگرنه متن ساده. */
  sendOtp(mobile: string, code: string): Promise<void>;
}

/** خطای ارسال پیامک؛ پیام آن فارسی و برای نمایش به کاربر/ادمین امن است (بدون کلید یا جزئیات داخلی). */
export class SmsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsError";
  }
}

/** پیاده‌سازی شبیه‌سازی‌شده: به‌جای ارسال واقعی، پیام را در کنسول سرور چاپ می‌کند. */
class MockSmsPanel implements SmsPanel {
  async sendSms(mobile: string, text: string): Promise<void> {
    console.log(`[پیامک شبیه‌سازی] موبایل ${mobile} → ${text}`);
  }

  async sendOtp(mobile: string, code: string): Promise<void> {
    await this.sendSms(mobile, `کد ورود گت‌استوک: ${code}`);
  }
}

const IRANPAYAMAK_BASE = "https://api.iranpayamak.com/ws/v1";
const REQUEST_TIMEOUT_MS = 10_000;

class IranPayamakSmsPanel implements SmsPanel {
  constructor(
    private readonly apiKey: string,
    private readonly lineNumber: string,
    private readonly otpPatternCode: string | null,
  ) {}

  private async post(path: string, payload: Record<string, unknown>): Promise<void> {
    let res: Response;
    try {
      res = await fetch(`${IRANPAYAMAK_BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Api-Key": this.apiKey,
        },
        body: JSON.stringify({ ...payload, line_number: this.lineNumber, number_format: "english" }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      console.error("[پیامک] اتصال به ایران‌پیامک ناموفق بود:", error instanceof Error ? error.message : error);
      throw new SmsError("ارسال پیامک ناموفق بود؛ چند دقیقه‌ی دیگر دوباره تلاش کن.");
    }

    const body = await res.json().catch(() => null);
    const ok = res.ok && (body?.status === undefined || body.status === "success");
    if (!ok) {
      // کلید API هرگز لاگ نمی‌شود؛ فقط کد وضعیت و پیام سرویس‌دهنده (برای عیب‌یابی ادمین در لاگ سرور).
      console.error(`[پیامک] ایران‌پیامک خطا برگرداند (${path}، HTTP ${res.status}):`, JSON.stringify(body));
      throw new SmsError("ارسال پیامک ناموفق بود؛ چند دقیقه‌ی دیگر دوباره تلاش کن.");
    }
  }

  async sendSms(mobile: string, text: string): Promise<void> {
    await this.post("/sms/simple", { text, recipients: [mobile] });
  }

  async sendOtp(mobile: string, code: string): Promise<void> {
    if (this.otpPatternCode) {
      // پترن باید متغیری به نام code داشته باشد (مثلاً «کد ورود شما به گت استوک: %code%»).
      await this.post("/sms/pattern", {
        code: this.otpPatternCode,
        attributes: { code },
        recipient: mobile,
      });
      return;
    }
    await this.sendSms(mobile, `کد ورود گت‌استوک: ${code}`);
  }
}

/**
 * انتخاب پیاده‌سازی پنل پیامک فعال:
 * - کلید API نیست → MockSmsPanel (فقط توسعه؛ در production هشدار چاپ می‌شود چون کد فقط در لاگ می‌ماند).
 * - کلید هست ولی شماره‌ی خط نیست → خطا (ارسال بی‌صدا به Mock باعث گم شدن کد کاربران می‌شد).
 * - هر دو هست → ایران‌پیامک (کد OTP با پترن اگر SMS_OTP_PATTERN_CODE تنظیم شده باشد).
 */
export async function getSmsPanel(): Promise<SmsPanel> {
  const [apiKey, lineNumber, otpPatternCode] = await Promise.all([
    getSetting("SMS_PANEL_API_KEY"),
    getSetting("SMS_LINE_NUMBER"),
    getSetting("SMS_OTP_PATTERN_CODE"),
  ]);

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[پیامک] SMS_PANEL_API_KEY تنظیم نشده؛ پیامک‌ها فقط در لاگ سرور چاپ می‌شوند و به کاربر نمی‌رسند.");
    }
    return new MockSmsPanel();
  }
  if (!lineNumber) {
    console.error("[پیامک] SMS_LINE_NUMBER (شماره‌ی خط ارسال) در تنظیمات ادمین پر نشده است.");
    throw new SmsError("سرویس پیامک هنوز کامل تنظیم نشده است؛ با پشتیبانی تماس بگیر.");
  }
  return new IranPayamakSmsPanel(apiKey, lineNumber, otpPatternCode?.trim() || null);
}
