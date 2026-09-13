// لایه‌ی انتزاعی درگاه پرداخت. منطق بالادست (route شارژ کیف پول) فقط با این اینترفیس کار می‌کند
// تا جایگزینی MockGateway با ZarinpalGateway واقعی بدون تغییر در بقیه‌ی کد ممکن باشد.

import crypto from "crypto";

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
  requestPayment(amountRial: bigint, callbackUrl: string): Promise<GatewayRequestResult>;
  /** پرداخت را نزد درگاه تأیید می‌کند؛ مبلغ باید با مبلغ ثبت‌شده مطابقت داشته باشد. */
  verifyPayment(authority: string, amountRial: bigint): Promise<GatewayVerifyResult>;
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

/**
 * انتخاب پیاده‌سازی درگاه فعال. برای اتصال زرین‌پال واقعی، فقط این تابع را
 * تغییر بده (مثلاً بر اساس process.env.PAYMENT_GATEWAY) و یک ZarinpalGateway
 * که همین PaymentGateway را پیاده‌سازی می‌کند اضافه کن؛ بقیه‌ی کد دست‌نخورده می‌ماند.
 */
export function getGateway(): PaymentGateway {
  return new MockGateway();
}
