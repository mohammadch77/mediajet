import { NextRequest, NextResponse } from "next/server";
import { validateInput, verifyOtpInput, ValidationError } from "@/lib/validation";
import { verifyOtp, OtpError } from "@/lib/otp";
import { findOrCreateUserByMobile, createSession } from "@/lib/session";
import { prisma } from "@/lib/db";

// POST /api/auth/verify-otp
// تأیید کد OTP؛ در صورت موفقیت کاربر را (در صورت نبود) می‌سازد و نشست ورود ایجاد می‌کند.
export async function POST(req: NextRequest) {
  let input;
  try {
    const body = await req.json();
    input = validateInput(verifyOtpInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    await verifyOtp(input.mobile, input.code);
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }

  const user = await findOrCreateUserByMobile(input.mobile);
  await createSession(user.id);

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });

  return NextResponse.json({
    userId: user.id,
    mobile: user.mobile,
    walletBalanceRial: (wallet?.balanceRial ?? 0n).toString(),
  });
}
