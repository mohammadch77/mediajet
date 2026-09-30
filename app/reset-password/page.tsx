import type { Metadata } from "next";
import ResetPasswordForm from "./ResetPasswordForm";

// توکن در URL است؛ no-referrer تا با کلیک روی لینکی در این صفحه به سایت دیگری نشت نکند.
export const metadata: Metadata = {
  title: "بازیابی رمز عبور — مدیاجت",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage({ searchParams }: { searchParams: { t?: string } }) {
  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <ResetPasswordForm token={typeof searchParams.t === "string" ? searchParams.t : ""} />
    </div>
  );
}
