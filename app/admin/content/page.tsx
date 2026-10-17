"use client";
import { useEffect, useState } from "react";
import { toJalaliDateTime } from "@/lib/jalali";

type ContentRow = {
  key: string;
  group: string;
  label: string;
  value: string;
  isDefault: boolean;
  updatedAt: string | null;
  updatedByMobile: string | null;
};

const GROUP_LABELS: Record<string, string> = {
  hero: "هیرو لندینگ",
  contact: "تماس با ما",
  legal: "مشخصات حقوقی کسب‌وکار",
  footer: "فوتر",
  header: "هدر (منو)",
  affiliate: "معرفی همکاری در فروش",
  seo: "سئو و Search Console",
};

const GROUP_ORDER = ["hero", "contact", "legal", "footer", "header", "affiliate", "seo"];

const LONG_FIELD_KEYS = new Set([
  "hero.subtitle",
  "contact.description",
  "contact.address",
  "footer.copyright",
  "affiliate.subtitle",
]);

function GroupSection({
  group,
  rows,
  onSaved,
}: {
  group: string;
  rows: ContentRow[];
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, r.value]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const fields = rows
        .filter((r) => values[r.key] !== r.value)
        .map((r) => ({ key: r.key, value: values[r.key] ?? "" }));
      if (fields.length === 0) {
        setBusy(false);
        return;
      }
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در ذخیره‌ی محتوا.");
      setOk(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره‌ی محتوا.");
    } finally {
      setBusy(false);
    }
  }

  const lastUpdated = rows
    .filter((r) => r.updatedAt)
    .sort((a, b) => (b.updatedAt! > a.updatedAt! ? 1 : -1))[0];

  return (
    <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4 sm:p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <h2 className="font-display font-bold text-[1.05rem]">{GROUP_LABELS[group] ?? group}</h2>
        {lastUpdated && (
          <div className="text-[.72rem] text-dim">
            آخرین به‌روزرسانی: {toJalaliDateTime(lastUpdated.updatedAt!)}
            {lastUpdated.updatedByMobile ? ` توسط ${lastUpdated.updatedByMobile}` : ""}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rows.map((r) => (
          <div key={r.key} className={LONG_FIELD_KEYS.has(r.key) ? "sm:col-span-2" : ""}>
            <label className="block text-[.8rem] font-bold mb-1.5">
              {r.label}
              {r.isDefault && <span className="text-dim font-normal"> (پیش‌فرض)</span>}
            </label>
            {LONG_FIELD_KEYS.has(r.key) ? (
              <textarea
                value={values[r.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
                rows={3}
                className="w-full bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition resize-y"
              />
            ) : (
              <input
                type="text"
                value={values[r.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))}
                className="w-full bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={save}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary-deep text-white text-[.85rem] font-bold disabled:opacity-50 transition"
        >
          {busy ? "در حال ذخیره…" : "ذخیره‌ی این بخش"}
        </button>
        {error && <div className="text-danger text-[.78rem]">{error}</div>}
        {ok && !error && <div className="text-success text-[.78rem]">ذخیره شد.</div>}
      </div>
    </div>
  );
}

export default function AdminContentPage() {
  const [rows, setRows] = useState<ContentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/admin/content");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت محتوا.");
      setRows(json.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت محتوا.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const groups = GROUP_ORDER.filter((g) => (rows ?? []).some((r) => r.group === g));

  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Content</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">مدیریت محتوای سایت</h1>
        <p className="text-dim text-[.85rem] mt-1">
          متن‌های هیرو، تماس با ما، فوتر و منوی هدر را ویرایش کن. فیلدی که تنظیم نشده باشد، همان متن پیش‌فرض فعلی سایت را نشان می‌دهد.
        </p>
      </div>

      {error && (
        <div className="bg-[rgb(var(--c-danger)/.1)] border border-[rgb(var(--c-danger)/.3)] text-danger rounded-xl px-4 py-3 text-[.85rem] mb-5">
          {error}
        </div>
      )}

      {!rows && !error && <div className="text-dim text-[.85rem]">در حال بارگذاری…</div>}

      {rows &&
        groups.map((group) => (
          <GroupSection key={group} group={group} rows={rows.filter((r) => r.group === group)} onSaved={load} />
        ))}
    </div>
  );
}
