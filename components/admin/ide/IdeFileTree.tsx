"use client";
// درخت فایل با بارگذاری تنبل (هر پوشه با اولین باز شدن از سرور خوانده می‌شود).

import { useEffect, useState } from "react";

export type TreeEntry = { name: string; path: string; type: "dir" | "file"; size: number };

type Props = {
  activePath: string | null;
  onOpenFile: (path: string) => void;
  onLocked: () => void;
  refreshKey: number;
};

async function fetchTree(path: string): Promise<TreeEntry[]> {
  const res = await fetch(`/api/admin/ide/tree?path=${encodeURIComponent(path)}`);
  const json = await res.json();
  if (res.status === 401) throw new Error("locked");
  if (!res.ok) throw new Error(json.error ?? "خطا در دریافت پوشه.");
  return json.entries;
}

function Folder({ entry, depth, ...props }: { entry: TreeEntry; depth: number } & Props) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ paddingInlineStart: 8 + depth * 14 }}
        className="w-full text-right flex items-center gap-1.5 py-1.5 pe-2 text-[.82rem] hover:bg-[rgb(var(--c-ov)/.06)] rounded-lg transition"
      >
        <span className="text-dim w-3 text-[.7rem]">{open ? "▾" : "◂"}</span>
        <span className="truncate latin">{entry.name}</span>
      </button>
      {open && <Directory path={entry.path} depth={depth + 1} {...props} />}
    </div>
  );
}

function Directory({ path, depth, ...props }: { path: string; depth: number } & Props) {
  const [entries, setEntries] = useState<TreeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchTree(path)
      .then((e) => !cancelled && setEntries(e))
      .catch((e: Error) => {
        if (cancelled) return;
        if (e.message === "locked") props.onLocked();
        else setError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, props.refreshKey]);

  if (error) return <div className="text-accent2 text-[.75rem] px-3 py-1">{error}</div>;
  if (!entries) return <div className="text-dim text-[.75rem] px-3 py-1">...</div>;

  return (
    <div>
      {entries.map((entry) =>
        entry.type === "dir" ? (
          <Folder key={entry.path} entry={entry} depth={depth} {...props} />
        ) : (
          <button
            key={entry.path}
            type="button"
            onClick={() => props.onOpenFile(entry.path)}
            style={{ paddingInlineStart: 8 + depth * 14 + 16 }}
            className={
              "w-full text-right py-1.5 pe-2 text-[.82rem] rounded-lg transition truncate latin " +
              (props.activePath === entry.path
                ? "bg-[rgb(var(--c-primary)/.18)] text-text"
                : "text-dim hover:text-text hover:bg-[rgb(var(--c-ov)/.06)]")
            }
          >
            {entry.name}
          </button>
        ),
      )}
    </div>
  );
}

export default function IdeFileTree(props: Props) {
  return (
    <div dir="rtl" className="text-right">
      <Directory path="" depth={0} {...props} />
    </div>
  );
}
