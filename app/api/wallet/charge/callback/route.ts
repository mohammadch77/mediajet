import { NextRequest, NextResponse } from "next/server";
import { confirmCharge, PaymentError } from "@/lib/payment";
import { GatewayError, buildCallbackUrl, CHARGE_RETURN_COOKIE } from "@/lib/gateway";

// GET/POST /api/wallet/charge/callback
// بازگشت از درگاه پرداخت با Authority و Status. تأیید و شارژ کیف پول این‌جا اتفاق می‌افتد
// (نه در صفحه‌ی UI)، چون این تنها مسیری است که درگاه واقعی هم صدا می‌زند.
async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const authority = url.searchParams.get("Authority");
  const status = url.searchParams.get("Status");

  // اگر شارژ از صفحه‌ی سبد خرید شروع شده، کاربر به همان‌جا برمی‌گردد؛ وگرنه داشبورد.
  const returnToCart = req.cookies.get(CHARGE_RETURN_COOKIE)?.value === "cart";
  const dashboardUrl = new URL(buildCallbackUrl(returnToCart ? "/cart" : "/dashboard", req.url));

  const redirect = () => {
    const res = NextResponse.redirect(dashboardUrl);
    res.cookies.delete(CHARGE_RETURN_COOKIE);
    return res;
  };

  if (!authority) {
    dashboardUrl.searchParams.set("charge", "failed");
    return redirect();
  }

  try {
    const result = await confirmCharge(authority, status === "OK");
    dashboardUrl.searchParams.set("charge", result.status === "verified" ? "success" : "failed");
  } catch (error) {
    if (error instanceof PaymentError) {
      dashboardUrl.searchParams.set("charge", "failed");
    } else if (error instanceof GatewayError) {
      // تأیید با درگاه قطعی نشد؛ پرداخت در وضعیت قبلی مانده و با callback بعدی قابل پیگیری است.
      dashboardUrl.searchParams.set("charge", "pending");
    } else {
      throw error;
    }
  }

  return redirect();
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}
