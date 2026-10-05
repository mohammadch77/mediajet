"use client";
// دکمه‌های «غیرفعال/فعال‌سازی» و «حذف» کاربر برای پنل ادمین؛ مشترک بین لیست و صفحه‌ی جزئیات.
import { useState } from "react";

type Props = {
  user: { id: string; mobile: string; disabledAt: string | null };
  onChanged: () => void | Promise<void>;
  /** بعد از حذف موفق (مثلاً بازگشت به لیست) به‌جای onChanged صدا زده می‌شود. */
  onDeleted?: () => void | Promise<void>;
  compact?: boolean;
};

type Dialog = "disable" | "enable" | "delete" | null;

export default function UserActions({ user, onChanged, onDeleted, compact }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = !!user.disabledAt;

  function close() {
    setDialog(null);
    setReason("");
    setError(null);
  }

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    setError(null);
    try {
      const res =
        dialog === "delete"
          ? await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
          : await fetch(`/api/admin/users/${user.id}/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ disabled: dialog === "disable", reason: reason.trim() || undefined }),
            });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "عملیات ناموفق بود.");
      const wasDelete = dialog === "delete";
      close();
      if (wasDelete && onDeleted) await onDeleted();
      else await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const btn = compact ? "px-3 py-1.5 text-[.74rem]" : "px-4 py-2 text-[.82rem]";
  const titles = { disable: "غیرفعال‌سازی کاربر", enable: "فعال‌سازی کاربر", delete: "حذف دائمی کاربر" } as const;
  const messages = {
    disable: `«${user.mobile}» غیرفعال شود؟ همین الان از همه‌ی دستگاه‌ها خارج می‌شود و دیگر نمی‌تواند وارد شود. سفارش‌ها و کیف پولش دست‌نخورده می‌ماند.`,
    enable: `«${user.mobile}» دوباره فعال شود؟`,
    delete: `«${user.mobile}» برای همیشه از دیتابیس حذف شود؟ این کار برگشت‌پذیر نیست. اگر کاربر سفارش یا تراکنش مالی داشته باشد حذف نمی‌شود و باید غیرفعالش کنید.`,
  } as const;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setDialog(disabled ? "enable" : "disable")}
          className={`${btn} font-bold rounded-full border border-[rgb(var(--c-primary2)/.25)] bg-[rgb(var(--c-ov)/.04)] hover:border-cyan transition`}
        >
          {disabled ? "فعال‌سازی" : "غیرفعال‌سازی"}
        </button>
        <button
          onClick={() => setDialog("delete")}
          className={`${btn} font-bold rounded-full bg-[rgb(var(--c-accent)/.12)] text-accent2 border border-[rgb(var(--c-accent)/.3)]`}
        >
          حذف
        </button>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" onClick={busy ? undefined : close}>
          <div
            className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-2xl p-6 max-w-[420px] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold text-lg mb-2">{titles[dialog]}</h3>
            <p className="text-dim text-[.88rem] mb-4 leading-relaxed">{messages[dialog]}</p>
            {dialog === "disable" && (
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="دلیل (اختیاری)"
                maxLength={300}
                className="w-full mb-4 bg-bg border border-[rgb(var(--c-primary2)/.14)] rounded-xl p-[10px_12px] text-[.88rem] outline-none focus:border-primary"
              />
            )}
            {error && <div className="text-accent2 text-[.84rem] mb-4">{error}</div>}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={close}
                disabled={busy}
                className="px-4 py-2 rounded-full text-[.85rem] font-bold text-dim hover:text-text bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] transition disabled:opacity-60"
              >
                انصراف
              </button>
              <button
                onClick={submit}
                disabled={busy}
                className={
                  "px-4 py-2 rounded-full text-[.85rem] font-bold text-white disabled:opacity-60 " +
                  (dialog === "delete" ? "bg-accent" : "bg-gradient-to-br from-primary to-primary2")
                }
              >
                {busy ? "..." : dialog === "delete" ? "حذف دائمی" : dialog === "disable" ? "غیرفعال کن" : "فعال کن"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
