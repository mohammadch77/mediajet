"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, type AuthUser } from "@/lib/AuthContext";
import CredentialsForm, { authInputClass, authButtonClass, postJson, PASSWORD_HINT } from "@/components/CredentialsForm";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { login, setUser } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmail, setNeedsEmail] = useState<{ user: AuthUser; password: string } | null>(null);

  // توکن از نوار آدرس و تاریخچه‌ی مرورگر حذف می‌شود تا بعد از باز شدن صفحه جایی باقی نماند.
  useEffect(() => {
    if (token) window.history.replaceState(null, "", "/reset-password");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (password !== confirm) {
      setError("تکرار رمز عبور با خودش یکی نیست.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await postJson<{ user: AuthUser }>("/api/auth/password-reset/confirm", { token, newPassword: password });
      if (!data.user.email) {
        setUser(data.user);
        setNeedsEmail({ user: data.user, password });
        return;
      }
      login(data.user);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطایی رخ داد.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[420px] bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.2)] rounded-[22px] p-[26px_20px] sm:p-[30px_26px] shadow-[0_40px_100px_-30px_rgba(0,0,0,.85)]">
      <h1 className="font-display text-[1.35rem] font-extrabold mb-1.5">بازیابی رمز عبور</h1>

      {!token ? (
        <>
          <p className="text-accent2 text-[.9rem] mb-5">لینک بازیابی ناقص یا نامعتبر است. دوباره درخواست بازیابی بده.</p>
          <Link href="/" className="text-cyan font-semibold hover:underline text-[.9rem]">
            بازگشت به صفحه‌ی اصلی
          </Link>
        </>
      ) : needsEmail ? (
        <>
          <p className="text-dim text-[.88rem] mb-5">
            رمز عبورت تغییر کرد. برای ورود بدون پیامک، یک ایمیل هم برای حسابت ثبت کن.
          </p>
          <CredentialsForm
            user={needsEmail.user}
            knownCurrentPassword={needsEmail.password}
            submitLabel="ذخیره‌ی ایمیل"
            onSaved={(u) => {
              login(u);
              router.replace("/dashboard");
            }}
          />
          <button
            type="button"
            onClick={() => {
              login(needsEmail.user);
              router.replace("/dashboard");
            }}
            className="w-full mt-3 font-body cursor-pointer bg-transparent border-none text-dim hover:text-text text-[.85rem] underline"
          >
            بعداً
          </button>
        </>
      ) : (
        <>
          <p className="text-dim text-[.88rem] mb-5">رمز عبور جدیدت را وارد کن. این لینک فقط یک‌بار قابل استفاده است.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              dir="ltr"
              required
              minLength={8}
              placeholder="رمز عبور جدید"
              aria-label="رمز عبور جدید"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass + " text-left"}
            />
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              dir="ltr"
              required
              placeholder="تکرار رمز عبور جدید"
              aria-label="تکرار رمز عبور جدید"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={authInputClass + " text-left"}
            />
            <span className="text-dim text-[.75rem]">{PASSWORD_HINT}</span>
            {error && <p className="text-[.85rem] text-accent2 text-center">{error}</p>}
            <button type="submit" disabled={submitting} className={authButtonClass + " mt-2"}>
              {submitting ? "لطفاً صبر کن..." : "تغییر رمز و ورود"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
