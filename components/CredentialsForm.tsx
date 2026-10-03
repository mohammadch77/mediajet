"use client";
// فرم تنظیم/تغییر ایمیل و رمز عبور. autocomplete استاندارد تا مرورگر خودش پیشنهاد ذخیره‌ی رمز بدهد؛
// ما رمز را هیچ‌جا در کلاینت ذخیره نمی‌کنیم.

import { useState } from "react";
import type { AuthUser } from "@/lib/AuthContext";

export const authInputClass =
  "w-full font-body text-[1rem] bg-[rgb(var(--c-ov)/.05)] border border-[rgb(var(--c-primary2)/.2)] rounded-[12px] px-4 py-3 text-text placeholder:text-muted outline-none transition focus:border-[rgb(var(--c-primary2)/.6)]";

export const authButtonClass =
  "w-full font-body cursor-pointer border-none font-bold text-[1rem] text-white bg-gradient-to-br from-primary to-primary2 px-[18px] py-3.5 rounded-[12px] transition hover:-translate-y-px hover:shadow-[0_0_60px_-10px_#6B5BFF] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0";

export const PASSWORD_HINT = "حداقل ۸ نویسه، شامل حرف و عدد.";

/** POST با بدنه‌ی JSON؛ پیام خطای فارسی سرور را به‌صورت Error پرتاب می‌کند. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("خطا در ارتباط با سرور. دوباره تلاش کن.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "خطایی رخ داد.");
  return data as T;
}

type Props = {
  user: AuthUser;
  onSaved: (user: AuthUser) => void;
  submitLabel?: string;
  /** وقتی کاربر همین الان رمز را تنظیم کرده (بعد از بازیابی)، رمز فعلی را از او دوباره نمی‌پرسیم. */
  knownCurrentPassword?: string;
};

export default function CredentialsForm({ user, onSaved, submitLabel, knownCurrentPassword }: Props) {
  const needsCurrent = user.hasPassword && !knownCurrentPassword;
  const [email, setEmail] = useState(user.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState(knownCurrentPassword ?? "");
  const [confirm, setConfirm] = useState(knownCurrentPassword ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSaved(false);
    if (newPassword !== confirm) {
      setError("تکرار رمز عبور با خودش یکی نیست.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await postJson<{ user: AuthUser }>("/api/auth/credentials", {
        email,
        newPassword,
        ...(user.hasPassword && { currentPassword: knownCurrentPassword ?? currentPassword }),
      });
      setSaved(true);
      setCurrentPassword("");
      onSaved(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطایی رخ داد.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-dim text-[.82rem]">ایمیل</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          dir="ltr"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass + " text-left"}
        />
      </label>

      {needsCurrent && (
        <label className="flex flex-col gap-1.5">
          <span className="text-dim text-[.82rem]">رمز عبور فعلی</span>
          <input
            type="password"
            name="current-password"
            autoComplete="current-password"
            dir="ltr"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={authInputClass + " text-left"}
          />
        </label>
      )}

      {!knownCurrentPassword && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-dim text-[.82rem]">{user.hasPassword ? "رمز عبور جدید" : "رمز عبور"}</span>
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              dir="ltr"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={authInputClass + " text-left"}
            />
            <span className="text-dim text-[.75rem]">{PASSWORD_HINT}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-dim text-[.82rem]">تکرار رمز عبور</span>
            <input
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              dir="ltr"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={authInputClass + " text-left"}
            />
          </label>
        </>
      )}

      {error && <p className="text-[.85rem] text-accent2 text-center">{error}</p>}
      {saved && !error && <p className="text-[.85rem] text-cyan text-center">ذخیره شد.</p>}

      <button type="submit" disabled={submitting} className={authButtonClass + " mt-1"}>
        {submitting ? "در حال ذخیره..." : (submitLabel ?? "ذخیره")}
      </button>
    </form>
  );
}
