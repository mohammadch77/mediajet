"use client";
// آپلود زیپ ← پیش‌نمایش تغییرات ← تأیید و اعمال. تا تأیید هیچ فایلی عوض نمی‌شود.

import { useRef, useState } from "react";

type Plan = {
  planId: string;
  added: number;
  modified: number;
  unchanged: number;
  skipped: { path: string; reason: string }[];
  changes: { path: string; status: "added" | "modified"; size: number }[];
  truncated: boolean;
};

const MAX_MB = 50;

export default function IdeZipDialog({
  onClose,
  onApplied,
  onLocked,
}: {
  onClose: () => void;
  onApplied: () => void;
  onLocked: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function upload(file: File) {
    setError(null);
    setPlan(null);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`حجم زیپ بیشتر از ${MAX_MB} مگابایت است.`);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ide/zip/preview", {
        method: "POST",
        headers: { "Content-Type": "application/zip" },
        body: file,
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) return onLocked();
      if (!res.ok) throw new Error(json.error ?? (res.status === 413 ? "حجم فایل برای سرور (nginx) زیاد است." : "پیش‌نمایش ناموفق بود."));
      setPlan(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "پیش‌نمایش ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ide/zip/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.planId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) return onLocked();
      if (!res.ok) throw new Error(json.error ?? "اعمال ناموفق بود.");
      setDone(json.applied);
      setPlan(null);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "اعمال ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  const nothingToApply = plan && plan.added + plan.modified === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:px-4" onClick={busy ? undefined : onClose}>
      <div
        className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[560px] max-h-[88vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg">آپلود و اعمال زیپ کد</h3>
          <button onClick={onClose} disabled={busy} className="text-dim hover:text-text px-2" aria-label="بستن">✕</button>
        </div>
        <p className="text-dim text-[.82rem] leading-[1.9] mb-4">
          زیپ کد پروژه را انتخاب کن. اول فقط پیش‌نمایش تغییرات نشان داده می‌شود. فایل‌های محرمانه (.env، کلیدها)،
          node_modules و .next نادیده گرفته می‌شوند، فایل‌های جایگزین‌شده پشتیبان‌گیری می‌شوند و فایل‌هایی که در زیپ نیستند حذف نمی‌شوند.
        </p>

        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="w-full py-3 rounded-xl font-bold border border-dashed border-[rgb(var(--c-primary2)/.4)] text-primary2 hover:bg-[rgb(var(--c-primary)/.08)] transition disabled:opacity-60 mb-4"
        >
          {busy && !plan ? "در حال بررسی..." : "انتخاب فایل زیپ"}
        </button>

        {error && <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-xl p-3 mb-4 text-[.84rem]">{error}</div>}
        {done !== null && (
          <div className="bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.3)] text-cyan rounded-xl p-3 mb-4 text-[.84rem] leading-[1.9]">
            {done} فایل اعمال شد. برای دیدن تغییرات در سایت، «Deploy» را بزن.
          </div>
        )}

        {plan && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              {[
                ["جدید", plan.added],
                ["تغییرکرده", plan.modified],
                ["بدون تغییر", plan.unchanged],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-xl bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.12)] py-2.5">
                  <div className="font-display font-bold text-lg">{n}</div>
                  <div className="text-dim text-[.74rem]">{label}</div>
                </div>
              ))}
            </div>

            {plan.changes.length > 0 && (
              <div dir="ltr" className="latin max-h-[200px] overflow-y-auto rounded-xl border border-[rgb(var(--c-primary2)/.12)] mb-3 text-left">
                {plan.changes.map((c) => (
                  <div key={c.path} className="flex items-center gap-2 px-3 py-1.5 text-[.76rem] border-b border-[rgb(var(--c-primary2)/.08)] last:border-0">
                    <span className={"w-4 font-bold " + (c.status === "added" ? "text-cyan" : "text-primary2")}>{c.status === "added" ? "+" : "~"}</span>
                    <span className="truncate">{c.path}</span>
                  </div>
                ))}
                {plan.truncated && <div className="text-dim px-3 py-1.5 text-[.74rem]">… و موارد بیشتر</div>}
              </div>
            )}

            {plan.skipped.length > 0 && (
              <details className="text-dim text-[.78rem] mb-3">
                <summary className="cursor-pointer">{plan.skipped.length} فایل نادیده گرفته شد</summary>
                <div dir="ltr" className="latin mt-1 text-left">
                  {plan.skipped.map((s) => (
                    <div key={s.path} className="truncate">{s.path} — {s.reason}</div>
                  ))}
                </div>
              </details>
            )}

            <button
              type="button"
              onClick={apply}
              disabled={busy || !!nothingToApply}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-br from-primary to-primary2 transition hover:-translate-y-px disabled:opacity-60"
            >
              {nothingToApply ? "تغییری برای اعمال نیست" : busy ? "در حال اعمال..." : `تأیید و اعمال ${plan.added + plan.modified} فایل`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
