import { NextRequest, NextResponse } from "next/server";
import { validateInput, requestOtpInput, ValidationError } from "@/lib/validation";
import { requestOtp, OtpError } from "@/lib/otp";

// POST /api/auth/request-otp
// ارسال کد تأیید برای موبایل داده‌شده (در حالت شبیه‌سازی، کد در کنسول سرور چاپ می‌شود).
export async function POST(req: NextRequest) {
  let input;
  try {
    const body = await req.json();
    input = validateInput(requestOtpInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    await requestOtp(input.mobile);
  } catch (error) {
    if (error instanceof OtpError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
