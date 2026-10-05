"use client";
// مودال ورود:
//   ورود با ایمیل/رمز (بدون پیامک) | ورود/ثبت‌نام با موبایل (OTP)
//   بعد از OTP، اگر کاربر هنوز ایمیل/رمز ندارد (ثبت‌نام جدید یا کاربر قدیمی) → مرحله‌ی تنظیم ایمیل/رمز (قابل رد کردن)
//   فراموشی رمز → پیامک کد و/یا لینک (بسته به تنظیم PASSWORD_RESET_SMS_MODE)

import { useEffect, useRef, useState } from "react";
import { useAuth, type AuthUser } from "@/lib/AuthContext";
import { toPersianDigits } from "@/lib/money";
import CredentialsForm, { authInputClass, authButtonClass, postJson, PASSWORD_HINT } from "@/components/CredentialsForm";
import BrandLogo from "@/components/BrandLogo";

const RESEND_SECONDS = 60;
const MOBILE_PATTERN = /^09\d{9}$/;

type Step = "password" | "mobile" | "code" | "credentials" | "forgot" | "forgotSent";
type ResetMode = "code" | "link" | "both";

export default function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login, setUser } = useAuth();
  const [step, setStep] = useState<Step>("password");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetMode, setResetMode] = useState<ResetMode>("code");
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [resetPassword, setResetPassword] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStep("password");
      setMobile("");
      setCode("");
      setEmail("");
      setPassword("");
      setConfirm("");
      setPendingUser(null);
      setResetPassword(undefined);
      setError(null);
      setNotice(null);
      setSubmitting(false);
      setCountdown(0);
    }
  }, [open]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  useEffect(() => {
    if (step === "code" || step === "forgotSent") codeInputRef.current?.focus();
  }, [step]);

  if (!open) return null;

  function goTo(next: Step) {
    setError(null);
    setNotice(null);
    setCode("");
    setPassword("");
    setConfirm("");
    setStep(next);
  }

  // اگر کاربر وسط مرحله‌ی ایمیل/رمز مودال را ببندد، ورودش با OTP انجام شده و معتبر می‌ماند.
  function handleClose() {
    if (pendingUser) login(pendingUser);
    else onClose();
  }

  /** بعد از ورود موفق: اگر کاربر ایمیل/رمز ندارد، اول آن را می‌خواهیم؛ وگرنه مودال بسته می‌شود. */
  function finishLogin(user: AuthUser, justSetPassword?: string) {
    if (!user.hasPassword || !user.email) {
      setUser(user);
      setPendingUser(user);
      setResetPassword(justSetPassword);
      goTo("credentials");
    } else {
      login(user);
    }
  }

  async function run(action: () => Promise<void>) {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطایی رخ داد.");
    } finally {
      setSubmitting(false);
    }
  }

  function requireMobile(): boolean {
    if (!MOBILE_PATTERN.test(mobile)) {
      setError("شماره موبایل معتبر نیست.");
      return false;
    }
    return true;
  }

  const passwordLogin = () =>
    run(async () => {
      const data = await postJson<{ user: AuthUser }>("/api/auth/login", { email, password });
      login(data.user);
    });

  const requestOtp = () => {
    if (!requireMobile()) return;
    return run(async () => {
      await postJson("/api/auth/request-otp", { mobile });
      goTo("code");
      setCountdown(RESEND_SECONDS);
    });
  };

  const verifyOtp = () => {
    if (!/^\d{6}$/.test(code)) {
      setError("کد تأیید باید ۶ رقم باشد.");
      return;
    }
    return run(async () => {
      const data = await postJson<{ user: AuthUser }>("/api/auth/verify-otp", { mobile, code });
      finishLogin(data.user);
    });
  };

  const requestReset = () => {
    if (!requireMobile()) return;
    return run(async () => {
      const data = await postJson<{ mode: ResetMode; message: string }>("/api/auth/password-reset/request", { mobile });
      setResetMode(data.mode);
      goTo("forgotSent");
      setNotice(data.message);
      setCountdown(RESEND_SECONDS);
    });
  };

  const confirmReset = () => {
    if (!/^\d{6}$/.test(code)) {
      setError("کد بازیابی باید ۶ رقم باشد.");
      return;
    }
    if (password !== confirm) {
      setError("تکرار رمز عبور با خودش یکی نیست.");
      return;
    }
    return run(async () => {
      const data = await postJson<{ user: AuthUser }>("/api/auth/password-reset/confirm", {
        mobile,
        code,
        newPassword: password,
      });
      finishLogin(data.user, password);
    });
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "password") passwordLogin();
    else if (step === "mobile") requestOtp();
    else if (step === "code") verifyOtp();
    else if (step === "forgot") requestReset();
    else if (step === "forgotSent") confirmReset();
  }

  const titles: Record<Step, { title: string; subtitle: string }> = {
    password: { title: "ورود به حساب", subtitle: "با ایمیل و رمز عبورت وارد شو." },
    mobile: { title: "ورود / ثبت‌نام با موبایل", subtitle: "شماره موبایلت را وارد کن تا کد تأیید برایت ارسال شود." },
    code: { title: "کد تأیید را وارد کن", subtitle: `کد ۶ رقمی برای شماره‌ی ${toPersianDigits(mobile)} پیامک شد.` },
    credentials: {
      title: "ورود بدون پیامک",
      subtitle: "یک ایمیل و رمز عبور تنظیم کن تا دفعه‌های بعد بدون انتظار برای پیامک وارد شوی.",
    },
    forgot: { title: "فراموشی رمز عبور", subtitle: "شماره موبایل حسابت را وارد کن تا راه بازیابی برایت پیامک شود." },
    forgotSent: {
      title: resetMode === "link" ? "پیامک را بررسی کن" : "بازیابی رمز عبور",
      subtitle:
        resetMode === "link"
          ? "لینک بازیابی را از پیامک باز کن. اعتبار آن ۱ ساعت است."
          : resetMode === "both"
            ? "کد پیامک‌شده را وارد کن و رمز جدید بساز (یا لینک داخل پیامک را باز کن)."
            : "کد پیامک‌شده را وارد کن و رمز جدید بساز.",
    },
  };

  const showTabs = step === "password" || step === "mobile";
  const inputBase = authInputClass + " text-left";

  return (
    <div
      className="fixed inset-0 z-[400] grid place-items-center overflow-y-auto px-4 py-6 bg-[rgba(8,9,20,.72)] backdrop-blur-[6px]"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-[420px] bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-[22px] p-[26px_20px] sm:p-[30px_26px] shadow-[0_40px_100px_-30px_rgba(0,0,0,.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          aria-label="بستن"
          className="absolute top-4 left-4 text-dim hover:text-text transition text-xl leading-none cursor-pointer bg-transparent border-none"
        >
          ×
        </button>

        <div className="flex items-center gap-2.5 font-display font-extrabold text-[1.1rem] mb-1.5">
          <BrandLogo />
          گت‌استوک
        </div>

        {showTabs && (
          <div className="grid grid-cols-2 gap-1 p-1 mt-4 rounded-full bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.14)]">
            {(
              [
                ["password", "ایمیل و رمز"],
                ["mobile", "کد پیامکی"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => goTo(id)}
                className={
                  "font-body cursor-pointer border-none text-[.86rem] font-bold py-2 rounded-full transition " +
                  (step === id ? "bg-gradient-to-br from-primary to-primary2 text-white" : "bg-transparent text-dim hover:text-text")
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <h3 id="auth-modal-title" className="font-display text-[1.3rem] mt-4 mb-1.5">
          {titles[step].title}
        </h3>
        <p className="text-dim text-[.88rem] mb-5">
          {titles[step].subtitle}
        </p>

        {step === "credentials" && pendingUser ? (
          <>
            <CredentialsForm
              user={pendingUser}
              knownCurrentPassword={resetPassword}
              submitLabel={resetPassword ? "ذخیره‌ی ایمیل" : "ذخیره و ادامه"}
              onSaved={(u) => login(u)}
            />
            <button
              type="button"
              onClick={() => login(pendingUser)}
              className="w-full mt-3 font-body cursor-pointer bg-transparent border-none text-dim hover:text-text text-[.85rem] underline"
            >
              بعداً (فعلاً با کد پیامکی ادامه می‌دهم)
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {step === "password" && (
              <>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  dir="ltr"
                  required
                  placeholder="ایمیل"
                  aria-label="ایمیل"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputBase}
                />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  dir="ltr"
                  required
                  placeholder="رمز عبور"
                  aria-label="رمز عبور"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputBase}
                />
              </>
            )}

            {(step === "mobile" || step === "forgot") && (
              <input
                type="tel"
                name="mobile"
                autoComplete="tel-national"
                inputMode="numeric"
                dir="ltr"
                placeholder="09xxxxxxxxx"
                aria-label="شماره موبایل"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^\d]/g, ""))}
                maxLength={11}
                className={authInputClass + " text-center tracking-widest"}
              />
            )}

            {step === "code" && (
              <input
                ref={codeInputRef}
                type="text"
                name="one-time-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                dir="ltr"
                placeholder="------"
                aria-label="کد تأیید"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                maxLength={6}
                className={authInputClass + " text-center tracking-[.5em] text-[1.3rem]"}
              />
            )}

            {step === "forgotSent" && resetMode !== "link" && (
              <>
                <input
                  ref={codeInputRef}
                  type="text"
                  name="one-time-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="کد ۶ رقمی"
                  aria-label="کد بازیابی"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                  maxLength={6}
                  className={authInputClass + " text-center tracking-[.4em]"}
                />
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
                  className={inputBase}
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
                  className={inputBase}
                />
                <span className="text-dim text-[.75rem]">{PASSWORD_HINT}</span>
              </>
            )}

            {notice && !error && <p className="text-[.82rem] text-cyan text-center">{notice}</p>}
            {error && <p className="text-[.85rem] text-accent2 text-center">{error}</p>}

            {!(step === "forgotSent" && resetMode === "link") && (
              <button type="submit" disabled={submitting} className={authButtonClass + " mt-2"}>
                {submitting
                  ? "لطفاً صبر کن..."
                  : {
                      password: "ورود",
                      mobile: "ارسال کد تأیید",
                      code: "تأیید و ورود",
                      forgot: "ارسال پیامک بازیابی",
                      forgotSent: "تغییر رمز و ورود",
                      credentials: "",
                    }[step]}
              </button>
            )}
          </form>
        )}

        <div className="text-center mt-4 text-[.84rem] text-dim flex flex-col gap-2">
          {step === "password" && (
            <button type="button" onClick={() => goTo("forgot")} className="text-cyan font-semibold hover:underline bg-transparent border-none cursor-pointer">
              رمز عبورت را فراموش کرده‌ای؟
            </button>
          )}
          {step === "password" && (
            <span>
              حساب نداری؟{" "}
              <button type="button" onClick={() => goTo("mobile")} className="text-cyan font-semibold hover:underline bg-transparent border-none cursor-pointer">
                ثبت‌نام با شماره موبایل
              </button>
            </span>
          )}

          {(step === "code" || step === "forgotSent") &&
            (countdown > 0 ? (
              <span>ارسال مجدد تا {toPersianDigits(countdown)} ثانیه دیگر</span>
            ) : (
              <button
                type="button"
                onClick={step === "code" ? requestOtp : requestReset}
                disabled={submitting}
                className="text-cyan font-semibold hover:underline disabled:opacity-60 bg-transparent border-none cursor-pointer"
              >
                ارسال مجدد پیامک
              </button>
            ))}

          {(step === "code" || step === "forgot" || step === "forgotSent") && (
            <button
              type="button"
              onClick={() => goTo(step === "code" ? "mobile" : "password")}
              className="text-dim hover:text-text underline text-[.8rem] bg-transparent border-none cursor-pointer"
            >
              {step === "code" ? "تغییر شماره موبایل" : "بازگشت به ورود"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
