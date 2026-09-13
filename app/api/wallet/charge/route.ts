import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getGateway } from "@/lib/gateway";
import { validateInput, walletChargeInput, ValidationError } from "@/lib/validation";
import { getCurrentUser } from "@/lib/session";

// POST /api/wallet/charge
// یک تلاش شارژ کیف پول می‌سازد و کاربر را به صفحه‌ی پرداخت درگاه هدایت می‌کند.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای شارژ کیف پول باید وارد شوید." }, { status: 401 });
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
  const idempotencyKey = crypto.randomUUID();
  const callbackUrl = new URL("/api/wallet/charge/callback", req.url).toString();

  const gateway = getGateway();
  const { authority, redirectUrl } = await gateway.requestPayment(amountRial, callbackUrl);

  await prisma.payment.create({
    data: {
      userId: currentUser.id,
      amountRial,
      status: "initiated",
      authority,
      idempotencyKey,
    },
  });

  return NextResponse.json({ redirectUrl });
}
