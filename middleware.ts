import { NextResponse, type NextRequest } from "next/server";
import { REF_COOKIE, REF_COOKIE_MAX_AGE_SECONDS, normalizeReferralCode } from "@/lib/referralCode";

// کد معرف از لینک ?ref=CODE در کوکی httpOnly نگه داشته می‌شود تا اگر کاربر بعداً
// (در همان ۳۰ روز) ثبت‌نام کرد، زیرمجموعه‌ی همان همکار شود. اعتبار واقعی کد فقط لحظه‌ی
// ساخت کاربر سمت سرور بررسی می‌شود (lib/session.ts)؛ این‌جا فقط شکل کد چک می‌شود.
export function middleware(req: NextRequest) {
  const code = normalizeReferralCode(req.nextUrl.searchParams.get("ref"));
  if (!code) return NextResponse.next();

  const res = NextResponse.next();
  res.cookies.set(REF_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REF_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}

export const config = {
  // فقط صفحات؛ API، فایل‌های استاتیک و تصاویر نیازی به این کار ندارند.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
