"use client";
// پنل‌های جانبی IDE: نقشه‌ی مسیرهای سایت و نسخه‌های پشتیبان فایل باز.

import { useEffect, useState } from "react";
import { toJalaliDateTime } from "@/lib/jalali";

type RouteEntry = { url: string; file: string; kind: "page" | "api" | "layout" };
type VersionEntry = { id: string; createdAt: string; size: number };

const KIND_LABEL: Record<RouteEntry["kind"], string> = { page: "صفحه", api: "API", layout: "چیدمان" };

export function IdeRoutesPanel({ onOpenFile, onLocked }: { onOpenFile: (path: string) => void; onLocked: () => void }) {
  const [routes, setRoutes] = useState<RouteEntry[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ide/routes")
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 401) return onLocked();
        if (!res.ok) throw new Error(json.error ?? "خطا در دریافت مسیرها.");
        setRoutes(json.routes);
      })
      .catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = (routes ?? []).filter((r) => !filter || r.url.includes(filter) || r.file.includes(filter));

  return (
    <div>
      <input aria-label="جستجو در مسیرها"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="جستجو در مسیرها…"
        dir="ltr"
        className="w-full bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-3.5 py-2 text-[.8rem] outline-none focus:border-cyan transition mb-2"
      />
      {error && <div className="text-accent2 text-[.78rem]">{error}</div>}
      {!routes && !error && <div className="text-dim text-[.78rem]">در حال بارگذاری...</div>}
      <div className="grid gap-1">
        {shown.map((r) => (
          <button
            key={r.file}
            type="button"
            onClick={() => onOpenFile(r.file)}
            className="text-right px-2.5 py-2 rounded-lg hover:bg-[rgb(var(--c-ov)/.06)] transition"
          >
            <div className="flex items-center justify-between gap-2">
              <span dir="ltr" className="latin text-[.8rem] font-semibold truncate">{r.url}</span>
              <span className="text-[.66rem] px-1.5 py-0.5 rounded-full bg-[rgb(var(--c-primary)/.14)] text-primary2 shrink-0">
                {KIND_LABEL[r.kind]}
              </span>
            </div>
            <div dir="ltr" className="latin text-dim text-[.7rem] truncate text-left">{r.file}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function IdeVersionsPanel({
  path,
  refreshKey,
  onRestore,
}: {
  path: string | null;
  refreshKey: number;
  onRestore: (versionId: string) => void;
}) {
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);

  useEffect(() => {
    if (!path) return setVersions(null);
    fetch(`/api/admin/ide/versions?path=${encodeURIComponent(path)}`)
      .then((res) => res.json())
      .then((json) => setVersions(json.versions ?? []))
      .catch(() => setVersions([]));
  }, [path, refreshKey]);

  if (!path) return <div className="text-dim text-[.8rem]">یک فایل باز کن تا نسخه‌های پشتیبانش را ببینی.</div>;
  if (!versions) return <div className="text-dim text-[.8rem]">در حال بارگذاری...</div>;
  if (versions.length === 0) return <div className="text-dim text-[.8rem]">هنوز نسخه‌ی پشتیبانی ندارد. با اولین ذخیره ساخته می‌شود.</div>;

  return (
    <div className="grid gap-2">
      {versions.map((v) => (
        <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-[rgb(var(--c-primary2)/.12)] px-3 py-2 text-[.78rem]">
          <span className="text-dim">{toJalaliDateTime(v.createdAt)}</span>
          <button
            type="button"
            onClick={() => onRestore(v.id)}
            className="px-3 py-1 rounded-full font-bold text-primary2 border border-[rgb(var(--c-primary2)/.3)] hover:bg-[rgb(var(--c-primary)/.12)] transition"
          >
            بازگردانی
          </button>
        </div>
      ))}
    </div>
  );
}
