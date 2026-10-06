"use client";
// تجربه‌ی بعد از یک خطای غیرمنتظره: کاربر هیچ‌وقت «خطا» یا جزئیات فنی نمی‌بیند. اول یک بارگذاری مجدد
// ملایم ("در حال آماده‌سازی…") و اگر دوباره شکست خورد، انتقال خودکار به صفحه‌ی اصلی. خطا همان لحظه
// بی‌صدا در لاگ ادمین ثبت می‌شود (توسط والد). حلقه‌ی بی‌پایان ندارد: شمارنده در sessionStorage است.

import { useEffect, useRef, useState } from "react";
import StatusScreen, { statusPrimaryBtn, statusSecondaryBtn } from "@/components/StatusScreen";

const KEY = "gs-soft-recovery";
const WINDOW_MS = 60_000;
const RETRY_AFTER_MS = 1400;
const REDIRECT_AFTER_MS = 3200;

function readAttempts(): number {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { n: number; t: number } | null;
    return raw && Date.now() - raw.t < WINDOW_MS ? raw.n : 0;
  } catch {
    return 0;
  }
}

function bumpAttempts(): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ n: readAttempts() + 1, t: Date.now() }));
  } catch {
    /* بی‌اثر */
  }
}

function Loader() {
  return (
    <div className="relative grid place-items-center" aria-hidden="true">
      <div className="mj-glow absolute inset-0 blur-[40px] rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-primary)/.5),transparent)]" />
      <div className="mj-spin w-[72px] h-[72px] rounded-full border-[5px] border-[rgb(var(--c-primary2)/.18)] border-t-primary2" />
    </div>
  );
}

export default function SoftRecovery({ onRetry }: { onRetry: () => void }) {
  // phase: retry = در حال تلاش مجدد، redirect = در حال بردن به صفحه‌ی اصلی
  const [phase, setPhase] = useState<"retry" | "redirect">("retry");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const onHome = window.location.pathname === "/";
    const attempts = readAttempts();
    bumpAttempts();

    if (attempts === 0) {
      const t = setTimeout(onRetry, RETRY_AFTER_MS);
      return () => clearTimeout(t);
    }
    // بار دوم: اگر در صفحه‌ی اصلی نیستیم به آن می‌رویم؛ در صفحه‌ی اصلی فقط دکمه‌ی تلاش دوباره می‌ماند.
    if (!onHome) {
      setPhase("redirect");
      const t = setTimeout(() => window.location.replace("/"), REDIRECT_AFTER_MS);
      return () => clearTimeout(t);
    }
  }, [onRetry]);

  const retrying = phase === "retry" && readAttempts() <= 1;

  return (
    <StatusScreen
      visual={<Loader />}
      title={phase === "redirect" ? "در حال بردنت به صفحه‌ی اصلی..." : "یک لحظه صبر کن..."}
      description={
        phase === "redirect"
          ? "این بخش الان آماده نیست. تا چند لحظه‌ی دیگر به صفحه‌ی اصلی می‌روی و می‌توانی کارت را از آن‌جا ادامه بدهی."
          : "داریم صفحه را برایت آماده می‌کنیم. اگر چند ثانیه طول کشید، دکمه‌ی پایین را بزن."
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a href="/" className={statusPrimaryBtn}>
          رفتن به صفحه‌ی اصلی
        </a>
        {!retrying && phase !== "redirect" && (
          <button type="button" onClick={() => { bumpAttempts(); onRetry(); }} className={statusSecondaryBtn}>
            تلاش دوباره
          </button>
        )}
      </div>
    </StatusScreen>
  );
}
