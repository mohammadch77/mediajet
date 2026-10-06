"use client";
// ابزار توسعه‌ی پنل ادمین: مرور و ویرایش کد پروژه، نقشه‌ی مسیرها و نسخه‌های پشتیبان.
// امنیت: فلگ سروری + نقش admin + رمز مجدد (کوکی ۲۰ دقیقه‌ای)؛ هر عمل در IdeAuditLog ثبت می‌شود.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import IdeZipDialog from "@/components/admin/ide/IdeZipDialog";
import IdeDeployDialog from "@/components/admin/ide/IdeDeployDialog";
import IdeFileTree from "@/components/admin/ide/IdeFileTree";
import { IdeRoutesPanel, IdeVersionsPanel } from "@/components/admin/ide/IdeSidePanels";

const IdeCodeEditor = dynamic(() => import("@/components/admin/ide/IdeCodeEditor"), {
  ssr: false,
  loading: () => <div className="text-dim p-4 text-[.85rem]">در حال بارگذاری ویرایشگر...</div>,
});

type Status = { enabled: boolean; unlocked: boolean; hasPassword: boolean; root?: string };
type OpenFile = { path: string; content: string; original: string; sha: string };
type SideTab = "files" | "routes" | "versions";
type Pending = { kind: "delete" } | { kind: "restore"; versionId: string } | { kind: "close"; path: string } | null;

const fieldClass =
  "w-full bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-4 py-2.5 text-[.88rem] outline-none focus:border-cyan transition";

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export default function AdminIdePage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const [files, setFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SideTab>("files");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [treeKey, setTreeKey] = useState(0);
  const [versionsKey, setVersionsKey] = useState(0);
  const [newPath, setNewPath] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [dialog, setDialog] = useState<"zip" | "deploy" | null>(null);

  const active = files.find((f) => f.path === activePath) ?? null;
  const dirty = (f: OpenFile) => f.content !== f.original;
  const anyDirty = files.some(dirty);

  const loadStatus = useCallback(async () => {
    const { json } = await api("/api/admin/ide/status");
    setStatus(json.enabled === undefined ? { enabled: false, unlocked: false, hasPassword: false } : json);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // اگر سرور ۴۰۱ «قفل» داد (انقضای ۲۰ دقیقه)، فرم رمز را دوباره نشان بده؛ تب‌های باز و تغییرات ذخیره‌نشده می‌مانند.
  const onLocked = useCallback(() => setStatus((s) => (s ? { ...s, unlocked: false } : s)), []);

  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    const { res, json } = await api("/api/admin/ide/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setUnlocking(false);
    if (!res.ok) return setUnlockError(json.error ?? "باز کردن قفل ناموفق بود.");
    setPassword("");
    setStatus((s) => (s ? { ...s, unlocked: true } : s));
  }

  async function lock() {
    await api("/api/admin/ide/lock", { method: "POST" });
    setStatus((s) => (s ? { ...s, unlocked: false } : s));
  }

  async function openFile(path: string) {
    setSidebarOpen(false);
    if (files.some((f) => f.path === path)) return setActivePath(path);
    const { res, json } = await api(`/api/admin/ide/file?path=${encodeURIComponent(path)}`);
    if (res.status === 401) return onLocked();
    if (!res.ok) return setMessage({ type: "error", text: json.error ?? "باز کردن فایل ناموفق بود." });
    setFiles((prev) => [...prev, { path: json.path, content: json.content, original: json.content, sha: json.sha }]);
    setActivePath(json.path);
    setMessage(null);
  }

  function updateContent(content: string) {
    setFiles((prev) => prev.map((f) => (f.path === activePath ? { ...f, content } : f)));
  }

  async function save() {
    if (!active || saving || !dirty(active)) return;
    setSaving(true);
    const { res, json } = await api("/api/admin/ide/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: active.path, content: active.content, baseSha: active.sha }),
    });
    setSaving(false);
    if (res.status === 401) return onLocked();
    if (!res.ok) return setMessage({ type: "error", text: json.error ?? "ذخیره ناموفق بود." });
    setFiles((prev) =>
      prev.map((f) => (f.path === active.path ? { ...f, original: active.content, sha: json.sha } : f)),
    );
    setVersionsKey((k) => k + 1);
    setMessage({ type: "ok", text: "ذخیره شد. تغییر روی دیسک اعمال است؛ برای دیدنش در سایت build و ری‌استارت لازم است." });
  }

  async function createFile(e: React.FormEvent) {
    e.preventDefault();
    const path = newPath.trim();
    if (!path) return;
    const { res, json } = await api("/api/admin/ide/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (res.status === 401) return onLocked();
    if (!res.ok) return setMessage({ type: "error", text: json.error ?? "ساخت فایل ناموفق بود." });
    setNewPath("");
    setTreeKey((k) => k + 1);
    setMessage({ type: "ok", text: "فایل ساخته شد." });
    openFile(json.path);
  }

  function closeTab(path: string) {
    setFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      if (activePath === path) setActivePath(next.length ? next[next.length - 1].path : null);
      return next;
    });
  }

  async function runPending() {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "close") {
        closeTab(pending.path);
      } else if (pending.kind === "delete" && active) {
        const { res, json } = await api(`/api/admin/ide/file?path=${encodeURIComponent(active.path)}`, { method: "DELETE" });
        if (res.status === 401) return onLocked();
        if (!res.ok) return setMessage({ type: "error", text: json.error ?? "حذف ناموفق بود." });
        closeTab(active.path);
        setTreeKey((k) => k + 1);
        setMessage({ type: "ok", text: "فایل حذف شد. نسخه‌ی پشتیبانش در «نسخه‌ها» می‌ماند." });
      } else if (pending.kind === "restore" && active) {
        const { res, json } = await api("/api/admin/ide/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: active.path, versionId: pending.versionId }),
        });
        if (res.status === 401) return onLocked();
        if (!res.ok) return setMessage({ type: "error", text: json.error ?? "بازگردانی ناموفق بود." });
        const reread = await api(`/api/admin/ide/file?path=${encodeURIComponent(active.path)}`);
        if (reread.res.ok) {
          setFiles((prev) =>
            prev.map((f) =>
              f.path === active.path
                ? { ...f, content: reread.json.content, original: reread.json.content, sha: reread.json.sha }
                : f,
            ),
          );
        }
        setVersionsKey((k) => k + 1);
        setMessage({ type: "ok", text: "نسخه بازگردانده شد (نسخه‌ی قبلی هم پشتیبان‌گیری شد)." });
      }
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  // --- حالت‌های بدون ابزار ---------------------------------------------------
  const header = (
    <div className="mb-6">
      <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Developer</div>
      <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">ابزار توسعه</h1>
    </div>
  );

  if (!status) return <div>{header}<div className="text-dim">در حال بارگذاری...</div></div>;

  if (!status.enabled) {
    return (
      <div>
        {header}
        <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-6 max-w-[640px] leading-[1.9]">
          <p className="font-bold mb-2">این ابزار روی سرور غیرفعال است.</p>
          <p className="text-dim text-[.88rem]">
            چون دسترسی به کد یعنی کنترل کامل سرور، فقط با تنظیم سروری روشن می‌شود (نه از داخل پنل). روی سرور در فایل
            <span dir="ltr" className="latin mx-1">.env</span> این خط را اضافه کن و برنامه را ری‌استارت کن:
          </p>
          <pre dir="ltr" className="latin bg-[rgb(var(--c-ov)/.06)] rounded-xl px-4 py-3 mt-3 text-[.85rem] text-left">ADMIN_IDE_ENABLED=true</pre>
        </div>
      </div>
    );
  }

  if (!status.unlocked) {
    return (
      <div>
        {header}
        <form
          onSubmit={unlock}
          className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-6 max-w-[440px]"
        >
          <p className="font-bold mb-1">تأیید هویت</p>
          <p className="text-dim text-[.84rem] leading-[1.9] mb-4">
            برای دسترسی به کد، رمز عبور حساب ادمین را دوباره وارد کن. قفل بعد از ۲۰ دقیقه خودکار بسته می‌شود.
          </p>
          {!status.hasPassword ? (
            <div className="text-accent2 text-[.85rem] leading-[1.9]">
              حساب تو رمز عبور ندارد. ابتدا در «پروفایل» داشبورد ایمیل و رمز تعریف کن.
            </div>
          ) : (
            <>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز عبور"
                className={fieldClass + " mb-3"}
              />
              {unlockError && <div className="text-accent2 text-[.84rem] mb-3">{unlockError}</div>}
              <button
                type="submit"
                disabled={unlocking || !password}
                className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-br from-primary to-primary2 transition hover:-translate-y-px disabled:opacity-60"
              >
                {unlocking ? "..." : "باز کردن ابزار توسعه"}
              </button>
            </>
          )}
        </form>
        {files.length > 0 && (
          <p className="text-dim text-[.8rem] mt-3 max-w-[440px]">تب‌ها و تغییرات ذخیره‌نشده‌ی تو بعد از باز کردن قفل سر جایشان هستند.</p>
        )}
      </div>
    );
  }

  const sideTabs: { id: SideTab; label: string }[] = [
    { id: "files", label: "فایل‌ها" },
    { id: "routes", label: "مسیرها" },
    { id: "versions", label: "نسخه‌ها" },
  ];

  const sidebar = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 mb-3">
        {sideTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSideTab(t.id)}
            className={
              "flex-1 py-1.5 rounded-full text-[.78rem] font-bold border transition " +
              (sideTab === t.id
                ? "bg-[rgb(var(--c-primary)/.18)] border-primary2 text-text"
                : "border-[rgb(var(--c-primary2)/.2)] text-dim")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {sideTab === "files" && (
        <form onSubmit={createFile} className="flex gap-1.5 mb-3">
          <input
            dir="ltr"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="مسیر فایل جدید…"
            className="min-w-0 flex-1 latin bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-3 py-1.5 text-[.76rem] outline-none focus:border-cyan"
          />
          <button type="submit" className="px-3 rounded-full text-[.78rem] font-bold text-white bg-gradient-to-br from-primary to-primary2">
            +
          </button>
        </form>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {sideTab === "files" && (
          <IdeFileTree activePath={activePath} onOpenFile={openFile} onLocked={onLocked} refreshKey={treeKey} />
        )}
        {sideTab === "routes" && <IdeRoutesPanel onOpenFile={openFile} onLocked={onLocked} />}
        {sideTab === "versions" && (
          <IdeVersionsPanel
            path={activePath}
            refreshKey={versionsKey}
            onRestore={(versionId) => setPending({ kind: "restore", versionId })}
          />
        )}
      </div>
    </div>
  );

  const toolbarBtn =
    "px-3.5 py-1.5 rounded-full text-[.8rem] font-bold border transition disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div>
      {header}

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <button type="button" onClick={() => setSidebarOpen(true)} className={toolbarBtn + " lg:hidden border-[rgb(var(--c-primary2)/.3)]"}>
          ☰ فایل‌ها
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!active || !dirty(active) || saving}
          className={toolbarBtn + " text-white border-transparent bg-gradient-to-br from-primary to-primary2"}
        >
          {saving ? "در حال ذخیره..." : "ذخیره"}
        </button>
        <button
          type="button"
          onClick={() => setPending({ kind: "delete" })}
          disabled={!active}
          className={toolbarBtn + " border-[rgb(var(--c-accent)/.4)] text-accent2"}
        >
          حذف فایل
        </button>
        <span className="flex-1" />
        <a
          href="/api/admin/ide/zip"
          className={toolbarBtn + " border-[rgb(var(--c-primary2)/.3)] text-dim hover:text-text"}
        >
          دانلود زیپ کد
        </a>
        <button type="button" onClick={() => setDialog("zip")} className={toolbarBtn + " border-[rgb(var(--c-primary2)/.3)] text-dim hover:text-text"}>
          آپلود زیپ
        </button>
        <button
          type="button"
          onClick={() => setDialog("deploy")}
          className={toolbarBtn + " border-[rgb(var(--c-cyan)/.5)] text-cyan hover:bg-[rgb(var(--c-cyan)/.1)]"}
        >
          Deploy
        </button>
        <button type="button" onClick={lock} className={toolbarBtn + " border-[rgb(var(--c-primary2)/.3)] text-dim"}>
          بستن قفل
        </button>
      </div>

      {message && (
        <div
          className={
            "rounded-xl p-3 mb-3 text-[.84rem] border " +
            (message.type === "ok"
              ? "bg-[rgb(var(--c-cyan)/.1)] border-[rgb(var(--c-cyan)/.3)] text-cyan"
              : "bg-[rgb(var(--c-accent)/.1)] border-[rgb(var(--c-accent)/.3)] text-accent2")
          }
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-4 h-[calc(100dvh-300px)] min-h-[460px]">
        {/* دسکتاپ: سایدبار ثابت */}
        <aside className="hidden lg:block w-[280px] shrink-0 bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-3 h-full">
          {sidebar}
        </aside>

        <section className="flex-1 min-w-0 flex flex-col bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl overflow-hidden">
          <div className="flex overflow-x-auto border-b border-[rgb(var(--c-primary2)/.14)] shrink-0">
            {files.length === 0 && <div className="text-dim text-[.8rem] px-4 py-2.5">فایلی باز نیست</div>}
            {files.map((f) => (
              <div
                key={f.path}
                className={
                  "flex items-center gap-2 px-3 py-2 text-[.78rem] shrink-0 border-l border-[rgb(var(--c-primary2)/.1)] cursor-pointer " +
                  (f.path === activePath ? "bg-[rgb(var(--c-primary)/.14)]" : "text-dim hover:text-text")
                }
                onClick={() => setActivePath(f.path)}
              >
                <span dir="ltr" className="latin max-w-[180px] truncate">{f.path.split("/").pop()}</span>
                {dirty(f) && <span className="w-2 h-2 rounded-full bg-primary2" title="ذخیره‌نشده" />}
                <button
                  type="button"
                  aria-label="بستن تب"
                  onClick={(e) => {
                    e.stopPropagation();
                    dirty(f) ? setPending({ kind: "close", path: f.path }) : closeTab(f.path);
                  }}
                  className="text-dim hover:text-text leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {active && (
            <div dir="ltr" className="latin text-dim text-[.72rem] px-4 py-1.5 border-b border-[rgb(var(--c-primary2)/.1)] text-left truncate shrink-0">
              {active.path}
            </div>
          )}

          <div dir="ltr" className="flex-1 min-h-0 overflow-auto">
            {active ? (
              <IdeCodeEditor key={active.path} path={active.path} value={active.content} onChange={updateContent} onSave={save} />
            ) : (
              <div dir="rtl" className="text-dim text-[.88rem] p-6 leading-[1.9]">
                یک فایل از «فایل‌ها» یا یک صفحه از «مسیرها» را باز کن. ذخیره با دکمه یا Ctrl+S انجام می‌شود و
                قبل از هر ذخیره، نسخه‌ی قبلی در «نسخه‌ها» پشتیبان‌گیری می‌شود.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* موبایل/تبلت: سایدبار کشویی */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden bg-black/70" onClick={() => setSidebarOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] h-[80vh] bg-gradient-to-br from-surface to-bg2 border-t border-[rgb(var(--c-primary2)/.2)] rounded-t-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </div>
        </div>
      )}

      {dialog === "zip" && (
        <IdeZipDialog
          onClose={() => setDialog(null)}
          onLocked={() => {
            setDialog(null);
            onLocked();
          }}
          onApplied={() => {
            setTreeKey((k) => k + 1);
            setVersionsKey((k) => k + 1);
            // تب‌های باز ممکن است کهنه شده باشند؛ با بستن‌شان، باز کردن دوباره نسخه‌ی جدید را می‌خواند.
            setFiles((prev) => prev.filter((f) => f.content !== f.original));
            setActivePath((p) => (p && files.some((f) => f.path === p && f.content !== f.original) ? p : null));
          }}
        />
      )}
      {dialog === "deploy" && (
        <IdeDeployDialog
          onClose={() => setDialog(null)}
          onLocked={() => {
            setDialog(null);
            onLocked();
          }}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === "delete" ? "حذف فایل" : pending?.kind === "restore" ? "بازگردانی نسخه" : "بستن تب"
        }
        message={
          pending?.kind === "delete"
            ? `فایل «${active?.path}» حذف می‌شود. نسخه‌ی پشتیبانش می‌ماند و می‌توانی برش گردانی.`
            : pending?.kind === "restore"
              ? "محتوای این نسخه جای فایل فعلی می‌نشیند (فایل فعلی هم پشتیبان‌گیری می‌شود). تغییرات ذخیره‌نشده‌ی این تب از بین می‌رود."
              : "این تب تغییرات ذخیره‌نشده دارد. بسته شود؟"
        }
        confirmLabel={pending?.kind === "delete" ? "حذف" : pending?.kind === "restore" ? "بازگردانی" : "بستن بدون ذخیره"}
        busy={busy}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
