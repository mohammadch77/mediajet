"use client";
// Deploy از داخل پنل: گزینه‌ها ← اجرا در پس‌زمینه ← نمایش زنده‌ی لاگ. شکست tsc/build جلوی ری‌استارت را می‌گیرد.

import { useEffect, useRef, useState } from "react";

type Status = { id: string; state: "running" | "success" | "failed"; log: string };

const POLL_MS = 2000;

export default function IdeDeployDialog({ onClose, onLocked }: { onClose: () => void; onLocked: () => void }) {
  const [install, setInstall] = useState(false);
  const [migrate, setMigrate] = useState(false);
  const [deployId, setDeployId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmMigrate, setConfirmMigrate] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  // وقتی پنجره باز می‌شود، اگر deployِ در حال اجرا هست دنبالش کن (مثلاً بعد از بستن پنجره).
  useEffect(() => {
    fetch("/api/admin/ide/deploy")
      .then((r) => r.json())
      .then((j) => {
        if (j.status?.state === "running") {
          setDeployId(j.status.id);
          setStatus(j.status);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!deployId || status?.state === "success" || status?.state === "failed") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/ide/deploy?id=${deployId}`);
        if (res.status === 401) return onLocked();
        const json = await res.json();
        if (res.ok && json.status) setStatus(json.status);
      } catch {
        // ری‌استارت برنامه لحظه‌ای ارتباط را قطع می‌کند؛ دوباره تلاش می‌شود.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployId, status?.state]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [status?.log]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ide/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ install, migrate }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) return onLocked();
      if (!res.ok) throw new Error(json.error ?? "شروع deploy ناموفق بود.");
      setDeployId(json.id);
      setStatus({ id: json.id, state: "running", log: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "شروع deploy ناموفق بود.");
    } finally {
      setStarting(false);
    }
  }

  const running = status?.state === "running";
  const stateLabel = status?.state === "success" ? "موفق" : status?.state === "failed" ? "ناموفق" : "در حال اجرا...";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:px-4" onClick={running ? undefined : onClose}>
      <div
        className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[640px] max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg">Deploy تغییرات</h3>
          <button onClick={onClose} className="text-dim hover:text-text px-2" aria-label="بستن">✕</button>
        </div>

        {!deployId && (
          <>
            <p className="text-dim text-[.82rem] leading-[1.9] mb-4">
              مراحل: بررسی نوع‌ها (tsc) ← ساخت برنامه (build) ← ری‌استارت. اگر tsc یا build خطا بدهد، ری‌استارت انجام
              نمی‌شود و نسخه‌ی در حال اجرا همان می‌ماند. سایت چند ثانیه حین build و ری‌استارت کند یا قطع می‌شود.
            </p>
            <label className="flex items-start gap-2.5 mb-3 text-[.86rem] cursor-pointer">
              <input type="checkbox" checked={install} onChange={(e) => setInstall(e.target.checked)} className="mt-1" />
              <span>
                نصب وابستگی‌ها (<span dir="ltr" className="latin">npm install</span>)
                <span className="block text-dim text-[.76rem]">فقط اگر package.json عوض شده یا کتابخانه‌ی جدید اضافه کرده‌ای.</span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 mb-4 text-[.86rem] cursor-pointer">
              <input
                type="checkbox"
                checked={migrate}
                onChange={(e) => {
                  setMigrate(e.target.checked);
                  setConfirmMigrate(false);
                }}
                className="mt-1"
              />
              <span>
                اعمال migrationهای دیتابیس (<span dir="ltr" className="latin">prisma migrate deploy</span>)
                <span className="block text-dim text-[.76rem]">روی دیتابیس واقعی اجرا می‌شود و برگشت‌پذیر نیست. قبلش حتماً بکاپ دیتابیس داشته باش.</span>
              </span>
            </label>
            {migrate && (
              <label className="flex items-start gap-2.5 mb-4 text-[.84rem] text-accent2 cursor-pointer">
                <input type="checkbox" checked={confirmMigrate} onChange={(e) => setConfirmMigrate(e.target.checked)} className="mt-1" />
                <span>بکاپ دیتابیس دارم و می‌دانم migration برگشت ندارد.</span>
              </label>
            )}
            {error && <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-xl p-3 mb-4 text-[.84rem]">{error}</div>}
            <button
              type="button"
              onClick={start}
              disabled={starting || (migrate && !confirmMigrate)}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-br from-primary to-primary2 transition hover:-translate-y-px disabled:opacity-60"
            >
              {starting ? "..." : "شروع Deploy"}
            </button>
          </>
        )}

        {deployId && (
          <>
            <div className="flex items-center gap-2 mb-3 text-[.86rem]">
              <span
                className={
                  "px-3 py-1 rounded-full font-bold text-[.78rem] " +
                  (status?.state === "success"
                    ? "bg-[rgb(var(--c-cyan)/.14)] text-cyan"
                    : status?.state === "failed"
                      ? "bg-[rgb(var(--c-accent)/.14)] text-accent2"
                      : "bg-[rgb(var(--c-primary)/.14)] text-primary2")
                }
              >
                {stateLabel}
              </span>
              {running && <span className="text-dim text-[.78rem]">می‌توانی پنجره را ببندی؛ فرایند ادامه دارد.</span>}
            </div>
            <pre
              ref={logRef}
              dir="ltr"
              className="latin text-left bg-black/50 rounded-xl p-3 text-[.72rem] leading-[1.6] h-[300px] overflow-auto whitespace-pre-wrap break-words"
            >
              {status?.log || "در حال شروع..."}
            </pre>
            {status?.state === "success" && (
              <p className="text-cyan text-[.82rem] mt-3">تمام شد و برنامه ری‌استارت شد. صفحه را رفرش کن تا نسخه‌ی جدید را ببینی.</p>
            )}
            {status?.state === "failed" && (
              <p className="text-accent2 text-[.82rem] mt-3 leading-[1.9]">
                Deploy ناموفق بود و ری‌استارت انجام نشد؛ سایت با نسخه‌ی قبلی ادامه می‌دهد. خطا را در لاگ ببین، فایل را اصلاح کن و دوباره بزن.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
