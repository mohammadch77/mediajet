"use client";
// مودال دو مرحله‌ای ورود: گرفتن شماره موبایل → گرفتن کد تأیید.

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { toPersianDigits } from "@/lib/money";

const RESEND_SECONDS = 60;

type Step = "mobile" | "code";

export default function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStep("mobile");
      setMobile("");
      setCode("");
      setError(null);
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
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  if (!open) return null;

  async function requestOtp() {
    setError(null);
    if (!/^09\d{9}$/.test(mobile)) {
      setError("شماره موبایل معتبر نیست.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطایی رخ داد.");
        return;
      }
      setStep("code");
      setCountdown(RESEND_SECONDS);
    } catch {
      setError("خطا در ارتباط با سرور. دوباره تلاش کن.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("کد تأیید باید ۶ رقم باشد.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "کد وارد شده نادرست است.");
        return;
      }
      login({ id: data.userId, mobile: data.mobile, name: data.name, role: data.role, walletBalanceRial: data.walletBalanceRial });
      onClose();
    } catch {
      setError("خطا در ارتباط با سرور. دوباره تلاش کن.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (step === "mobile") requestOtp();
    else verifyOtp();
  }

  return (
    <div
      className="fixed inset-0 z-[400] grid place-items-center px-4 bg-[rgba(8,9,20,.72)] backdrop-blur-[6px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.2)] rounded-[22px] p-[30px_26px] shadow-[0_40px_100px_-30px_rgba(0,0,0,.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute top-4 left-4 text-dim hover:text-text transition text-xl leading-none"
        >
          ×
        </button>

        <div className="flex items-center gap-2.5 font-display font-extrabold text-[1.1rem] mb-1.5">
          <span className="w-[28px] h-[28px] rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
              <path d="M3 12l7-2 2-7 2 7 7 2-7 2-2 7-2-7-7-2z" fill="#fff" />
            </svg>
          </span>
          مدیاجت
        </div>

        {step === "mobile" ? (
          <>
            <h3 className="font-display text-[1.35rem] mt-3 mb-1.5">ورود / ثبت‌نام</h3>
            <p className="text-dim text-[.9rem] mb-5">شماره موبایلت را وارد کن تا کد تأیید برایت ارسال شود.</p>
          </>
        ) : (
          <>
            <h3 className="font-display text-[1.35rem] mt-3 mb-1.5">کد تأیید را وارد کن</h3>
            <p className="text-dim text-[.9rem] mb-5">
              کد ۶ رقمی برای شماره‌ی {toPersianDigits(mobile)} پیامک شد.
              <br />
              <span className="text-[.8rem]">(در حالت آزمایشی، کد در کنسول سرور چاپ می‌شود.)</span>
            </p>
          </>
        )}

        <form onSubmit={handleSubmit}>
          {step === "mobile" ? (
            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              placeholder="09xxxxxxxxx"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/[^\d]/g, ""))}
              maxLength={11}
              className="w-full text-center tracking-widest font-body text-[1.05rem] bg-[rgba(255,255,255,.05)] border border-[rgba(138,124,255,.2)] rounded-[12px] px-4 py-3.5 text-text placeholder:text-[#5b6390] outline-none transition focus:border-[rgba(138,124,255,.6)]"
            />
          ) : (
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="------"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              maxLength={6}
              className="w-full text-center tracking-[.5em] font-body text-[1.3rem] bg-[rgba(255,255,255,.05)] border border-[rgba(138,124,255,.2)] rounded-[12px] px-4 py-3.5 text-text placeholder:text-[#5b6390] outline-none transition focus:border-[rgba(138,124,255,.6)]"
            />
          )}

          {error && (
            <p className="text-[.85rem] text-accent2 mt-3 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-5 font-body cursor-pointer border-none font-bold text-[1rem] text-white bg-gradient-to-br from-primary to-primary2 px-[18px] py-3.5 rounded-[12px] transition hover:-translate-y-px hover:shadow-[0_0_60px_-10px_#6B5BFF] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
          >
            {submitting ? "در حال ارسال..." : step === "mobile" ? "ارسال کد تأیید" : "تأیید و ورود"}
          </button>
        </form>

        {step === "code" && (
          <div className="text-center mt-4 text-[.85rem] text-dim">
            {countdown > 0 ? (
              <span>ارسال مجدد کد تا {toPersianDigits(countdown)} ثانیه دیگر</span>
            ) : (
              <button
                onClick={requestOtp}
                disabled={submitting}
                className="text-cyan font-semibold hover:underline disabled:opacity-60"
              >
                ارسال مجدد کد
              </button>
            )}
            <div className="mt-2">
              <button
                onClick={() => {
                  setStep("mobile");
                  setError(null);
                }}
                className="text-dim hover:text-text underline text-[.8rem]"
              >
                تغییر شماره موبایل
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
