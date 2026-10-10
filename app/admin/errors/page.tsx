"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/money";
import Pagination from "@/components/admin/Pagination";
import { reportClientError } from "@/lib/errorReporter";

type Row = {
  id: string; source: "client" | "server"; kind: string; message: string;
  file: string | null; line: number | null; column: number | null; locationMapped: boolean;
  url: string | null; statusCode: number | null; count: number; status: "open" | "resolved";
  firstSeenAt: string; lastSeenAt: string;
};
type ListResponse = { items: Row[]; total: number; page: number; totalPages: number; openCount: number };
type Detail = Row & {
  stack: string | null; resolvedStack: string | null; componentStack: string | null; functionName: string | null;
  userAgent: string | null; digest: string | null; resolvedAt: string | null;
  lastUser: { id: string; mobile: string; name: string | null } | null;
};

const inputCls = "bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-4 py-2.5 text-[.85rem] outline-none focus:border-cyan transition";

function locationLabel(r: Pick<Row, "file" | "line" | "column">): string {
  if (!r.file) return "مکان نامشخص";
  return `${r.file}${r.line ? `:${r.line}` : ""}${r.column ? `:${r.column}` : ""}`;
}

export default function AdminErrorsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [status, setStatus] = useState<"open" | "resolved" | "all">("open");
  const [source, setSource] = useState<"all" | "client" | "server">("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), status, source });
      if (debounced) qs.set("search", debounced);
      const res = await fetch(`/api/admin/errors?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت فهرست.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت فهرست.");
    }
  }, [page, status, source, debounced]);

  useEffect(() => { load(); }, [load]);

  async function openDetail(id: string) {
    setDetail(null);
    const res = await fetch(`/api/admin/errors/${id}`);
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "خطا در دریافت جزئیات."); return; }
    setDetail(json.error);
  }

  async function setResolved(id: string, next: "open" | "resolved") {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/errors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ناموفق بود.");
      setDetail(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "ناموفق بود."); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("این خطا برای همیشه حذف شود؟")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/errors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "حذف ناموفق بود.");
      setDetail(null);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "حذف ناموفق بود."); } finally { setBusy(false); }
  }

  async function testServer() {
    setNotice(null);
    const res = await fetch("/api/admin/errors/test", { method: "POST" });
    const json = await res.json();
    setNotice(res.ok ? json.note : json.error ?? "ناموفق بود.");
    setTimeout(load, 2500);
  }

  function testClient() {
    reportClientError({ kind: "error", message: "Error: خطای آزمایشی مرورگر (ساخته‌شده از پنل ادمین)", stack: new Error("test").stack });
    setNotice("خطای آزمایشی مرورگر ارسال شد؛ تا چند ثانیه دیگر در فهرست می‌آید.");
    setTimeout(load, 2500);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Error Log</div>
          <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">خطاهای سایت</h1>
          <p className="text-dim text-[.85rem] mt-1">خطاهای کاربران بی‌صدا ثبت می‌شوند و کاربر چیزی از آن‌ها نمی‌بیند. خطاهای تکراری یکی شمرده می‌شوند.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={testClient} className="px-4 py-2 rounded-full text-[.8rem] font-bold bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.2)] hover:border-cyan transition">ثبت خطای آزمایشی مرورگر</button>
          <button onClick={testServer} className="px-4 py-2 rounded-full text-[.8rem] font-bold bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.2)] hover:border-cyan transition">ثبت خطای آزمایشی سرور</button>
        </div>
      </div>

      {notice && <div className="bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.3)] rounded-2xl p-3 mb-4 text-[.85rem]">{notice}</div>}
      {error && <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 mb-5">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input aria-label="جستجو در پیام، فایل یا آدرس" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو در پیام، فایل یا آدرس…" className={inputCls + " flex-1 min-w-[220px] max-w-[360px]"} />
        <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} className={inputCls + " cursor-pointer"}>
          <option value="open" className="bg-bg2">باز{data ? ` (${toPersianDigits(data.openCount)})` : ""}</option>
          <option value="resolved" className="bg-bg2">حل‌شده</option>
          <option value="all" className="bg-bg2">همه</option>
        </select>
        <select value={source} onChange={(e) => { setSource(e.target.value as typeof source); setPage(1); }} className={inputCls + " cursor-pointer"}>
          <option value="all" className="bg-bg2">مرورگر و سرور</option>
          <option value="client" className="bg-bg2">فقط مرورگر</option>
          <option value="server" className="bg-bg2">فقط سرور</option>
        </select>
      </div>

      {!data ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : data.items.length === 0 ? (
        <div className="text-dim text-[.9rem]">خطایی ثبت نشده است. 🎉</div>
      ) : (
        <>
          <div className="grid gap-3">
            {data.items.map((r) => (
              <button key={r.id} onClick={() => openDetail(r.id)} className="text-right bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] hover:border-cyan rounded-2xl p-4 transition">
                <div className="flex flex-wrap items-center gap-2 mb-2 text-[.72rem] font-bold">
                  <span className={"px-2.5 py-1 rounded-full " + (r.source === "server" ? "bg-[rgb(var(--c-accent)/.15)] text-accent2" : "bg-[rgb(var(--c-cyan)/.15)] text-cyan")}>{r.source === "server" ? "سرور" : "مرورگر"}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[rgb(var(--c-ov)/.06)] latin">{r.kind}{r.statusCode ? ` ${r.statusCode}` : ""}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[rgb(var(--c-ov)/.06)]">{toPersianDigits(r.count)} بار</span>
                  {r.status === "resolved" && <span className="px-2.5 py-1 rounded-full bg-[rgb(var(--c-success)/.15)] text-success">حل‌شده</span>}
                </div>
                <div dir="ltr" className="text-left font-semibold text-[.88rem] break-words line-clamp-2">{r.message}</div>
                <div dir="ltr" className="text-left latin text-[.76rem] text-cyan mt-1.5 break-all">{locationLabel(r)}{!r.locationMapped && r.file ? " (بدون source map)" : ""}</div>
                <div className="text-dim text-[.72rem] mt-2">آخرین رخداد: {toJalaliDateTime(r.lastSeenAt)}{r.url ? ` — ${r.url}` : ""}</div>
              </button>
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-3 sm:p-6" onClick={() => setDetail(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[860px] max-h-[92vh] overflow-y-auto bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-3xl p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="font-display font-extrabold text-lg">جزئیات خطا</h2>
              <button onClick={() => setDetail(null)} className="text-dim hover:text-text text-xl leading-none" aria-label="بستن">×</button>
            </div>
            <Field label="پیام"><div dir="ltr" className="text-left break-words font-semibold">{detail.message}</div></Field>
            <Field label="محل خطا (فایل:خط:ستون)"><div dir="ltr" className="text-left latin text-cyan break-all">{locationLabel(detail)}{detail.functionName ? ` — ${detail.functionName}` : ""}</div>{!detail.locationMapped && detail.file && <div className="text-dim text-[.75rem] mt-1">source map در دسترس نبود؛ مکان ممکن است مربوط به فایل کامپایل‌شده باشد.</div>}</Field>
            <Field label="آدرس صفحه"><span dir="ltr" className="latin break-all">{detail.url ?? "—"}</span></Field>
            <Field label="کاربر درگیر (آخرین)">{detail.lastUser ? <Link className="text-cyan hover:underline" href={`/admin/users/${detail.lastUser.id}`}><span dir="ltr">{detail.lastUser.mobile}</span> {detail.lastUser.name ?? ""}</Link> : "مهمان / نامشخص"}</Field>
            <Field label="تعداد و زمان">{toPersianDigits(detail.count)} بار — اولین: {toJalaliDateTime(detail.firstSeenAt)} — آخرین: {toJalaliDateTime(detail.lastSeenAt)}</Field>
            <Field label="مرورگر"><span dir="ltr" className="latin text-[.75rem] break-all">{detail.userAgent ?? "—"}</span></Field>
            {(detail.resolvedStack ?? detail.stack) && <Field label={detail.resolvedStack ? "استک (با source map)" : "استک"}><Pre text={detail.resolvedStack ?? detail.stack ?? ""} /></Field>}
            {detail.componentStack && <Field label="استک کامپوننت‌ها"><Pre text={detail.componentStack} /></Field>}
            <div className="flex flex-wrap gap-2 mt-5">
              {detail.status === "open" ? (
                <button disabled={busy} onClick={() => setResolved(detail.id, "resolved")} className="px-5 py-2.5 rounded-full text-[.85rem] font-bold text-white bg-gradient-to-br from-primary to-primary-deep disabled:opacity-50">علامت‌گذاری به‌عنوان حل‌شده</button>
              ) : (
                <button disabled={busy} onClick={() => setResolved(detail.id, "open")} className="px-5 py-2.5 rounded-full text-[.85rem] font-bold bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.2)] disabled:opacity-50">بازکردن دوباره</button>
              )}
              <button disabled={busy} onClick={() => remove(detail.id)} className="px-5 py-2.5 rounded-full text-[.85rem] font-bold text-accent2 bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] disabled:opacity-50">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-dim text-[.75rem] mb-1">{label}</div>
      <div className="text-[.85rem]">{children}</div>
    </div>
  );
}

function Pre({ text }: { text: string }) {
  return <pre dir="ltr" className="text-left latin text-[.72rem] leading-[1.7] bg-[rgb(var(--c-ov)/.05)] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-[280px]">{text}</pre>;
}
