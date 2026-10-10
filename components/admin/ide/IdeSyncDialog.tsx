"use client";
// همگام‌سازی کد سرور با گیت‌هاب: مقایسه ← ارسال (push) / دریافت (pull) ← حل تعارض با انتخاب صریح.

import { useCallback, useEffect, useState } from "react";

type Item = {
  path: string;
  state: "push" | "pull" | "conflict";
  local: string;
  remote: string;
};
type SyncStatus = { branch: string; head: string; inSync: number; items: Item[]; skipped: string[] };

const CHANGE_LABEL: Record<string, string> = { edited: "ویرایش", added: "جدید", deleted: "حذف", same: "—" };
const btn = "px-4 py-2.5 rounded-xl font-bold text-[.84rem] transition disabled:opacity-50";

export default function IdeSyncDialog({ onClose, onLocked, onChanged }: { onClose: () => void; onLocked: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [message, setMessage] = useState("به‌روزرسانی از پنل ادمین");
  // انتخاب ادمین برای conflictها: مسیر → کدام طرف نگه داشته شود
  const [choice, setChoice] = useState<Record<string, "local" | "remote">>({});

  const call = useCallback(
    async (url: string, body?: unknown) => {
      const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        onLocked();
        throw new Error("قفل بسته شده است.");
      }
      if (!res.ok) throw new Error(json.error ?? "درخواست ناموفق بود.");
      return json;
    },
    [onLocked],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await call("/api/admin/ide/sync/status"));
      setChoice({});
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "دریافت وضعیت ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pushItems = status?.items.filter((i) => i.state === "push") ?? [];
  const pullItems = status?.items.filter((i) => i.state === "pull") ?? [];
  const conflicts = status?.items.filter((i) => i.state === "conflict") ?? [];
  const keepLocal = conflicts.filter((c) => choice[c.path] === "local").map((c) => c.path);
  const keepRemote = conflicts.filter((c) => choice[c.path] === "remote").map((c) => c.path);

  async function run(kind: "push" | "pull", paths?: string[]) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if (kind === "push") {
        const r = await call("/api/admin/ide/sync/push", { message, ...(paths ? { paths } : {}) });
        setNote(`${r.count} فایل در یک کامیت به گیت‌هاب رفت.`);
      } else {
        const r = await call("/api/admin/ide/sync/pull", paths ? { paths } : {});
        setNote(`${r.count} فایل از گیت‌هاب روی سرور آمد. برای اعمال روی سایت، Deploy را بزن.`);
        onChanged();
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  function renderList(items: Item[]) {
    return (
      <ul className="max-h-[160px] overflow-auto text-[.76rem] bg-black/30 rounded-xl p-2 mb-3 space-y-1">
        {items.map((i) => (
          <li key={i.path} className="flex justify-between gap-3" dir="ltr">
            <span className="latin break-all">{i.path}</span>
            <span className="text-dim shrink-0" dir="rtl">
              {i.state === "push" ? CHANGE_LABEL[i.local] : CHANGE_LABEL[i.remote]}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:px-4" onClick={busy ? undefined : onClose}>
      <div
        className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[680px] max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-lg">همگام‌سازی با گیت‌هاب</h3>
          <button onClick={onClose} className="text-dim hover:text-text px-2" aria-label="بستن">✕</button>
        </div>

        {loading && <p className="text-dim text-[.86rem]">در حال مقایسه با گیت‌هاب...</p>}
        {error && <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-xl p-3 mb-4 text-[.84rem]">{error}</div>}
        {note && <div className="bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.3)] text-cyan rounded-xl p-3 mb-4 text-[.84rem]">{note}</div>}

        {status && !loading && (
          <>
            <p className="text-dim text-[.8rem] mb-4">
              شاخه: <span dir="ltr" className="latin">{status.branch}</span> · هم‌خوان: {status.inSync} فایل
              {status.skipped.length > 0 && ` · ${status.skipped.length} فایل بزرگ‌تر از ۲ مگابایت نادیده گرفته شد`}
            </p>

            {status.items.length === 0 && <p className="text-cyan text-[.9rem]">سرور و گیت‌هاب کاملاً هم‌خوان‌اند.</p>}

            {pushItems.length > 0 && (
              <section className="mb-5">
                <h4 className="font-bold text-[.9rem] mb-2">تغییرات سرور، آماده‌ی ارسال به گیت‌هاب ({pushItems.length})</h4>
                {renderList(pushItems)}
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={200}
                  className="w-full mb-2 bg-black/30 border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3 py-2 text-[.84rem]"
                  aria-label="پیام کامیت"
                />
                <button disabled={busy} onClick={() => run("push")} className={btn + " text-white bg-gradient-to-br from-primary to-primary-deep"}>
                  ارسال به گیت‌هاب
                </button>
              </section>
            )}

            {pullItems.length > 0 && (
              <section className="mb-5">
                <h4 className="font-bold text-[.9rem] mb-2">تغییرات گیت‌هاب، آماده‌ی دریافت روی سرور ({pullItems.length})</h4>
                {renderList(pullItems)}
                <button disabled={busy} onClick={() => run("pull")} className={btn + " border border-[rgb(var(--c-cyan)/.5)] text-cyan"}>
                  دریافت از گیت‌هاب
                </button>
                <p className="text-dim text-[.74rem] mt-2">نسخه‌ی قبلی هر فایل در «نسخه‌ها» بکاپ می‌شود. بعد از دریافت، Deploy لازم است.</p>
              </section>
            )}

            {conflicts.length > 0 && (
              <section className="mb-2">
                <h4 className="font-bold text-[.9rem] mb-1 text-accent2">تعارض ({conflicts.length})</h4>
                <p className="text-dim text-[.76rem] mb-2 leading-[1.8]">این فایل‌ها هم روی سرور و هم روی گیت‌هاب تغییر کرده‌اند. برای هر کدام تعیین کن کدام نسخه بماند؛ نسخه‌ی دیگر بازنویسی می‌شود (نسخه‌ی سرور قبل از بازنویسی بکاپ می‌شود).</p>
                <ul className="space-y-2 mb-3">
                  {conflicts.map((c) => (
                    <li key={c.path} className="bg-black/30 rounded-xl p-2.5 text-[.78rem]">
                      <div dir="ltr" className="latin break-all mb-1.5">{c.path}</div>
                      <div className="flex gap-2 flex-wrap">
                        {(["local", "remote"] as const).map((side) => (
                          <button
                            key={side}
                            type="button"
                            onClick={() => setChoice((prev) => ({ ...prev, [c.path]: side }))}
                            className={
                              "px-3 py-1.5 rounded-lg border " +
                              (choice[c.path] === side ? "border-primary2 text-primary2 bg-[rgb(var(--c-primary)/.12)]" : "border-[rgb(var(--c-primary2)/.2)] text-dim")
                            }
                          >
                            {side === "local" ? `نگه‌داشتن نسخه‌ی سرور (${CHANGE_LABEL[c.local]})` : `نگه‌داشتن نسخه‌ی گیت‌هاب (${CHANGE_LABEL[c.remote]})`}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 flex-wrap">
                  <button disabled={busy || keepLocal.length === 0} onClick={() => run("push", keepLocal)} className={btn + " border border-[rgb(var(--c-primary2)/.4)]"}>
                    اعمال انتخاب‌های سرور ({keepLocal.length})
                  </button>
                  <button disabled={busy || keepRemote.length === 0} onClick={() => run("pull", keepRemote)} className={btn + " border border-[rgb(var(--c-primary2)/.4)]"}>
                    اعمال انتخاب‌های گیت‌هاب ({keepRemote.length})
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        <div className="mt-4">
          <button disabled={busy || loading} onClick={refresh} className={btn + " text-dim border border-[rgb(var(--c-primary2)/.25)]"}>
            بررسی دوباره
          </button>
        </div>
      </div>
    </div>
  );
}
