import { NextRequest, NextResponse } from "next/server";
import { confirmCharge, PaymentError } from "@/lib/payment";
import { GatewayError } from "@/lib/gateway";

// GET/POST /api/wallet/charge/callback
// بازگشت از درگاه پرداخت با Authority و Status. تأیید و شارژ کیف پول این‌جا اتفاق می‌افتد
// (نه در صفحه‌ی UI)، چون این تنها مسیری است که درگاه واقعی هم صدا می‌زند.
async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const authority = url.searchParams.get("Authority");
  const status = url.searchParams.get("Status");

  const dashboardUrl = new URL("/dashboard", req.url);

  if (!authority) {
    dashboardUrl.searchParams.set("charge", "failed");
    return NextResponse.redirect(dashboardUrl);
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

  return NextResponse.redirect(dashboardUrl);
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}
