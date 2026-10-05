// لایه‌ی انتزاعی درگاه پرداخت. منطق بالادست (route شارژ کیف پول) فقط با این اینترفیس کار می‌کند
// تا جایگزینی MockGateway با ZarinpalGateway واقعی بدون تغییر در بقیه‌ی کد ممکن باشد.

import crypto from "crypto";
import { getSetting } from "./settings";

export type GatewayRequestResult = {
  authority: string;
  redirectUrl: string;
};

export type GatewayVerifyResult = {
  ok: boolean;
  refId?: string;
};

export interface PaymentGateway {
  /** یک تلاش پرداخت می‌سازد و آدرس هدایت کاربر به صفحه‌ی پرداخت را برمی‌گرداند. */
  requestPayment(amountRial: bigint, callbackUrl: string, description?: string): Promise<GatewayRequestResult>;
  /**
   * پرداخت را نزد درگاه تأیید می‌کند؛ مبلغ باید با مبلغ ثبت‌شده مطابقت داشته باشد.
   * ok=false فقط برای ردِ قطعی درگاه است؛ خطای شبکه/نامشخص GatewayError پرتاب می‌کند
   * (تا تراکنش rollback شود و پرداخت در وضعیت قبلی بماند، نه «ناموفق» شدنِ اشتباه).
   */
  verifyPayment(authority: string, amountRial: bigint): Promise<GatewayVerifyResult>;
}

/** خطای درگاه؛ پیام فارسی و امن برای نمایش به کاربر است (بدون مرچنت یا جزئیات داخلی). */
export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayError";
  }
}

/**
 * آدرس بازگشت از درگاه. اگر APP_BASE_URL تنظیم باشد از آن ساخته می‌شود (پشت nginx، req.url
 * ممکن است localhost باشد و زرین‌پال آدرس بازگشت را رد کند)، وگرنه از آدرس درخواست.
 */
export function buildCallbackUrl(path: string, reqUrl: string): string {
  const base = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  return new URL(path, base || reqUrl).toString();
}

/**
 * درگاه شبیه‌سازی‌شده: هدایت به یک صفحه‌ی پرداخت داخلی (`/pay/mock`) با دکمه‌های
 * «پرداخت موفق» و «انصراف»، سپس بازگشت با همان پارامترهای Authority/Status که
 * درگاه واقعی (زرین‌پال) هم استفاده می‌کند.
 *
 * توجه: عمداً وضعیتی درون‌حافظه‌ای نگه نمی‌دارد (چون route handlerهای Next.js
 * لزوماً یک instance ماژول را بین درخواست‌ها به اشتراک نمی‌گذارند). اعتبارِ
 * authority و مبلغ همیشه از رکورد Payment سمت سرور (منبع حقیقت) تأیید می‌شود؛
 * verifyPayment این‌جا فقط جای فراخوانی واقعیِ API درگاه را می‌گیرد.
 * ZarinpalGateway واقعی به‌جای این، یک درخواست HTTP به سرور زرین‌پال می‌زند.
 */
export class MockGateway implements PaymentGateway {
  async requestPayment(amountRial: bigint, callbackUrl: string): Promise<GatewayRequestResult> {
    const authority = "MOCK-" + crypto.randomBytes(12).toString("hex");

    const redirectUrl =
      `/pay/mock?authority=${encodeURIComponent(authority)}` +
      `&amount=${amountRial.toString()}` +
      `&callback=${encodeURIComponent(callbackUrl)}`;

    return { authority, redirectUrl };
  }

  async verifyPayment(): Promise<GatewayVerifyResult> {
    return { ok: true, refId: "MOCK-REF-" + crypto.randomBytes(6).toString("hex") };
  }
}

const ZARINPAL_API = "https://api.zarinpal.com/pg/v4/payment";
const ZARINPAL_START_PAY = "https://www.zarinpal.com/pg/StartPay/";
const ZARINPAL_TIMEOUT_MS = 12_000;
const GATEWAY_BUSY = "اتصال به درگاه پرداخت برقرار نشد؛ چند دقیقه‌ی دیگر دوباره تلاش کن.";

type ZarinpalResponse = {
  data?: { code?: number; authority?: string; ref_id?: number | string } | unknown[];
  errors?: { code?: number; message?: string } | unknown[];
};

/**
 * درگاه واقعی زرین‌پال (API نسخه‌ی ۴). مبلغ همیشه به ریال ارسال می‌شود (واحد پیش‌فرض زرین‌پال)
 * و مرچنت هرگز لاگ نمی‌شود. کدهای خطای زرین‌پال فقط در لاگ سرور می‌آیند، نه در پاسخ به کاربر.
 */
export class ZarinpalGateway implements PaymentGateway {
  constructor(private readonly merchantId: string) {}

  private async call(endpoint: string, payload: Record<string, unknown>): Promise<ZarinpalResponse> {
    let res: Response;
    try {
      res = await fetch(`${ZARINPAL_API}/${endpoint}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ merchant_id: this.merchantId, ...payload }),
        signal: AbortSignal.timeout(ZARINPAL_TIMEOUT_MS),
      });
    } catch (error) {
      console.error(`[زرین‌پال] اتصال ناموفق (${endpoint}):`, error instanceof Error ? error.message : error);
      throw new GatewayError(GATEWAY_BUSY);
    }
    const body = (await res.json().catch(() => null)) as ZarinpalResponse | null;
    if (!body) {
      console.error(`[زرین‌پال] پاسخ نامعتبر (${endpoint}، HTTP ${res.status})`);
      throw new GatewayError(GATEWAY_BUSY);
    }
    return body;
  }

  async requestPayment(amountRial: bigint, callbackUrl: string, description = "پرداخت گت‌استوک"): Promise<GatewayRequestResult> {
    const body = await this.call("request", {
      amount: Number(amountRial),
      callback_url: callbackUrl,
      description,
    });
    const data = Array.isArray(body.data) ? null : body.data;
    if (data?.code !== 100 || !data.authority) {
      console.error("[زرین‌پال] درخواست پرداخت رد شد:", JSON.stringify(body.errors ?? body));
      throw new GatewayError("ایجاد پرداخت ناموفق بود؛ چند دقیقه‌ی دیگر دوباره تلاش کن.");
    }
    return { authority: data.authority, redirectUrl: ZARINPAL_START_PAY + data.authority };
  }

  async verifyPayment(authority: string, amountRial: bigint): Promise<GatewayVerifyResult> {
    const body = await this.call("verify", { amount: Number(amountRial), authority });
    const data = Array.isArray(body.data) ? null : body.data;
    // ۱۰۰ = تأیید موفق، ۱۰۱ = قبلاً تأیید شده (idempotency خودمان از شارژ مضاعف جلوگیری می‌کند).
    if (data?.code === 100 || data?.code === 101) {
      return { ok: true, refId: data.ref_id !== undefined ? String(data.ref_id) : undefined };
    }
    const errors = Array.isArray(body.errors) ? null : body.errors;
    // خطای اعتبارسنجی/ردِ قطعی (کد منفی) → ناموفق؛ هر چیز نامشخص → GatewayError تا بعداً دوباره تلاش شود.
    if (typeof errors?.code === "number" && errors.code < 0) {
      console.error(`[زرین‌پال] تأیید رد شد (کد ${errors.code}):`, errors.message);
      return { ok: false };
    }
    console.error("[زرین‌پال] پاسخ نامشخص در تأیید:", JSON.stringify(body));
    throw new GatewayError(GATEWAY_BUSY);
  }
}

/**
 * انتخاب درگاه فعال. مرچنت از تنظیمات رمزنگاری‌شده (پنل ادمین → تنظیمات) خوانده می‌شود.
 * - مرچنت هست → ZarinpalGateway (پرداخت واقعی).
 * - مرچنت نیست و production → خطا. MockGateway همیشه «پرداخت موفق» برمی‌گرداند و در production
 *   یعنی شارژ رایگان؛ پس فقط در توسعه مجاز است.
 */
export async function getGateway(): Promise<PaymentGateway> {
  const merchantId = (await getSetting("ZARINPAL_MERCHANT_ID"))?.trim();
  if (merchantId) return new ZarinpalGateway(merchantId);
  if (process.env.NODE_ENV === "production") {
    console.error("[درگاه] ZARINPAL_MERCHANT_ID در تنظیمات ادمین پر نشده است.");
    throw new GatewayError("درگاه پرداخت هنوز فعال نشده است.");
  }
  return new MockGateway();
}
