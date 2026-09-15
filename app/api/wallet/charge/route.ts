import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getGateway } from "@/lib/gateway";
import { validateInput, walletChargeInput, ValidationError } from "@/lib/validation";
import { getCurrentUser } from "@/lib/session";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { rialToTomanLabel } from "@/lib/money";

// شارژ کیف پول یک مسیر حساس مالی است: حداکثر ۱۰ تلاش در دقیقه برای هر کاربر.
const CHARGE_RATE_LIMIT = 10;
const CHARGE_RATE_WINDOW_MS = 60_000;

// POST /api/wallet/charge
// یک تلاش شارژ کیف پول می‌سازد و کاربر را به صفحه‌ی پرداخت درگاه هدایت می‌کند.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای شارژ کیف پول باید وارد شوید." }, { status: 401 });
  }

  // کلید محدودیت از session ساخته می‌شود، نه از ورودی کلاینت.
  const limit = checkRateLimit(
    `wallet-charge:${currentUser.id}`,
    CHARGE_RATE_LIMIT,
    CHARGE_RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(walletChargeInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const amountRial = BigInt(input.amountRial);

  // حداقل مبلغ شارژ از تنظیمات پرداخت (قابل تغییر توسط ادمین) خوانده می‌شود.
  const { walletMinChargeRial } = await getPaymentSettings();
  if (amountRial < walletMinChargeRial) {
    return NextResponse.json(
      {
        error: `حداقل مبلغ شارژ کیف پول ${rialToTomanLabel(Number(walletMinChargeRial))} است.`,
      },
      { status: 422 },
    );
  }

  const idempotencyKey = crypto.randomUUID();
  const callbackUrl = new URL("/api/wallet/charge/callback", req.url).toString();

  const gateway = await getGateway();
  const { authority, redirectUrl } = await gateway.requestPayment(amountRial, callbackUrl);

  await prisma.payment.create({
    data: {
      userId: currentUser.id,
      amountRial,
      status: "initiated",
      authority,
      redirectUrl,
      idempotencyKey,
    },
  });

  return NextResponse.json({ redirectUrl });
}
