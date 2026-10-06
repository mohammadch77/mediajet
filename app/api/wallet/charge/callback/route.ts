import { NextRequest, NextResponse } from "next/server";
import { confirmCharge, PaymentError } from "@/lib/payment";
import { GatewayError, buildResultUrl, CHARGE_RETURN_COOKIE } from "@/lib/gateway";
import { notifyWalletChange } from "@/lib/telegram";

// GET/POST /api/wallet/charge/callback
// بازگشت از درگاه پرداخت با Authority و Status. تأیید و شارژ کیف پول این‌جا اتفاق می‌افتد
// (نه در صفحه‌ی UI)، چون این تنها مسیری است که درگاه واقعی هم صدا می‌زند.
async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const authority = url.searchParams.get("Authority");
  const status = url.searchParams.get("Status");

  // اگر شارژ از صفحه‌ی سبد خرید شروع شده، دکمه‌ی بازگشت صفحه‌ی نتیجه به همان‌جا می‌رود.
  const returnToCart = req.cookies.get(CHARGE_RETURN_COOKIE)?.value === "cart";

  if (authority) {
    try {
      const result = await confirmCharge(authority, status === "OK");
      // اطلاع‌رسانی مالی فقط یک‌بار و فقط وقتی شارژ واقعاً در همین فراخوانی انجام شد.
      if (result.credited) {
        notifyWalletChange({ kind: "charge", ...result.credited });
      }
    } catch (error) {
      // PaymentError: پرداخت یافت نشد (صفحه‌ی نتیجه پیام مناسب می‌دهد)؛
      // GatewayError: تأیید قطعی نشد و پرداخت «در انتظار» می‌ماند.
      if (!(error instanceof PaymentError) && !(error instanceof GatewayError)) throw error;
    }
  }

  // کاربر همیشه به صفحه‌ی نتیجه روی دامنه‌ی واقعی برمی‌گردد؛ نتیجه از DB خوانده می‌شود.
  const res = NextResponse.redirect(buildResultUrl(req.url, authority, returnToCart));
  res.cookies.delete(CHARGE_RETURN_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}
