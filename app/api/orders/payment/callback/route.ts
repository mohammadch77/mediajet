import { NextRequest, NextResponse } from "next/server";
import { confirmOrderPayment, PaymentError } from "@/lib/payment";
import { GatewayError, buildResultUrl } from "@/lib/gateway";
import { rialToTomanLabel } from "@/lib/money";
import { notifyOrderCreated } from "@/lib/telegram";
import { prisma } from "@/lib/db";

// GET/POST /api/orders/payment/callback
// بازگشت از درگاه پرداخت برای پرداخت مستقیم یک سفارش (خواهر /api/wallet/charge/callback).
// تأیید پرداخت و صف‌شدن سفارش این‌جا اتفاق می‌افتد، نه در صفحه‌ی UI، چون این تنها مسیری
// است که درگاه واقعی هم صدا می‌زند.
async function handleCallback(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const authority = url.searchParams.get("Authority");
  const status = url.searchParams.get("Status");

  if (!authority) {
    return NextResponse.redirect(buildResultUrl(req.url, null));
  }

  try {
    const result = await confirmOrderPayment(authority, status === "OK");

    // اطلاع‌رسانی تلگرام فقط یک‌بار و فقط وقتی سفارش واقعاً در همین فراخوانی به صف رفت؛
    // در callback تکراری queued برابر null است، پس پیام دوباره ارسال نمی‌شود.
    if (result.queued) {
      const items = await prisma.orderItem.findMany({
        where: { orderId: result.queued.orderId },
        orderBy: { position: "asc" },
        select: { productUrl: true },
      });
      notifyOrderCreated({
        orderId: result.queued.orderId,
        priceLabel: rialToTomanLabel(Number(result.queued.priceRial)),
        items,
      });
    }
  } catch (error) {
    // PaymentError: پرداخت یافت نشد؛ GatewayError: تأیید قطعی نشد و پرداخت «در انتظار» می‌ماند.
    // در هر دو حالت صفحه‌ی نتیجه وضعیت واقعی را از DB نشان می‌دهد.
    if (!(error instanceof PaymentError) && !(error instanceof GatewayError)) throw error;
  }

  return NextResponse.redirect(buildResultUrl(req.url, authority));
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}
