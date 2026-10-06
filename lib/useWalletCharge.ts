"use client";

// منطق مشترک شارژ کیف پول (داشبورد و سبد خرید): ورودی مبلغ با جداکننده‌ی سه‌رقمی،
// اعتبارسنجی حداقل شارژ و شروع پرداخت از درگاه. مبلغ نهایی و حداقل همیشه سمت سرور هم بررسی می‌شود.

import { useState } from "react";
import { toEnglishDigits, toPersianDigits } from "@/lib/money";

/** مقدار نمایشی ورودی: ارقام انگلیسی با جداکننده‌ی سه‌رقمی (۱۰۰۰ → 1,000). */
export function formatTomanInput(digits: string): string {
  return digits ? Number(digits).toLocaleString("en-US") : "";
}

/** نمایش مبلغ تومان با ارقام فارسی و جداکننده. */
export function tomanLabel(toman: number): string {
  return toPersianDigits(toman.toLocaleString("en-US"));
}

/**
 * @param minRial حداقل شارژ به ریال (از /api/wallet)؛ تا بارگذاری null است.
 * @param returnTo مقصد بازگشت پس از پرداخت؛ فقط "cart" مجاز است (پیش‌فرض: داشبورد).
 */
export function useWalletCharge(minRial: number | null, returnTo?: "cart") {
  const [amountToman, setAmountToman] = useState("");
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onAmountChange(raw: string) {
    // فقط رقم؛ ارقام فارسی/عربی تبدیل و جداکننده‌ها حذف می‌شوند.
    const digits = toEnglishDigits(raw).replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
    setAmountToman(digits);
    setError(null);
  }

  function setPreset(toman: number) {
    setAmountToman(String(toman));
    setError(null);
  }

  async function startCharge() {
    if (charging) return;
    setError(null);
    const toman = Number(amountToman);
    if (!Number.isInteger(toman) || toman <= 0) {
      setError("مبلغ را به تومان و به‌صورت عدد صحیح وارد کن.");
      return;
    }
    const amountRial = toman * 10;
    if (minRial !== null && minRial > 0 && amountRial < minRial) {
      setError(`حداقل شارژ کیف پول ${tomanLabel(minRial / 10)} تومان است.`);
      return;
    }

    setCharging(true);
    try {
      const res = await fetch("/api/wallet/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRial, ...(returnTo && { returnTo }) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در شروع شارژ کیف پول.");
      }
      window.location.href = data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در شروع شارژ کیف پول.");
      setCharging(false);
    }
  }

  return { amountToman, charging, error, onAmountChange, setPreset, startCharge };
}
