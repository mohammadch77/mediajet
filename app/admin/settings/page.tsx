"use client";
import { useEffect, useState } from "react";
import { toJalaliDateTime } from "@/lib/jalali";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type SettingRow = {
  key: string;
  group: string;
  label: string;
  description: string;
  configured: boolean;
  updatedAt: string | null;
  updatedByMobile: string | null;
};

const GROUP_LABELS: Record<string, string> = {
  gateway: "درگاه پرداخت",
  sms: "پنل پیامک",
  telegram: "تلگرام",
};

function StatusDot({ configured }: { configured: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-[.78rem] font-bold">
      <span
        className={
          "w-2 h-2 rounded-full " + (configured ? "bg-success shadow-[0_0_8px_rgb(var(--c-success))]" : "bg-[rgb(var(--c-ov)/.25)]")
        }
      />
      <span className={configured ? "text-success" : "text-dim"}>
        {configured ? "تنظیم شده" : "تنظیم نشده"}
      </span>
    </span>
  );
}

function SettingCard({ row, onSaved }: { row: SettingRow; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function submit(method: "POST" | "DELETE", body: object, okMessage: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در ذخیره‌ی تنظیم.");
      setValue("");
      setOk(okMessage);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره‌ی تنظیم.");
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  }

  function save() {
    if (!value.trim()) {
      setError("مقدار را وارد کنید.");
      return;
    }
    submit("POST", { key: row.key, value: value.trim() }, "ذخیره شد.");
  }

  return (
    <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div className="font-bold text-[.95rem]">{row.label}</div>
        <StatusDot configured={row.configured} />
      </div>
      <p className="text-dim text-[.8rem] leading-relaxed mb-3">{row.description}</p>

      {row.configured && row.updatedAt && (
        <div className="text-[.72rem] text-dim mb-3">
          آخرین به‌روزرسانی: {toJalaliDateTime(row.updatedAt)}
          {row.updatedByMobile ? ` توسط ${row.updatedByMobile}` : ""}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={row.configured ? "برای تغییر، مقدار جدید را وارد کنید" : "مقدار را وارد کنید"}
          className="flex-1 min-w-[180px] bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition"
        />
        <button
          onClick={save}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary2 text-white text-[.85rem] font-bold disabled:opacity-50 transition"
        >
          {busy ? "در حال ذخیره…" : "ذخیره"}
        </button>
        {row.configured && (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl border border-[rgb(var(--c-danger)/.35)] text-danger text-[.85rem] font-bold hover:bg-[rgb(var(--c-danger)/.08)] disabled:opacity-50 transition"
          >
            حذف مقدار
          </button>
        )}
      </div>

      {error && <div className="text-danger text-[.78rem] mt-2">{error}</div>}
      {ok && !error && <div className="text-success text-[.78rem] mt-2">{ok}</div>}

      <ConfirmDialog
        open={confirmClear}
        title={`حذف «${row.label}»`}
        message="مقدار ذخیره‌شده در پنل حذف می‌شود و از این پس مقدار .env سرور (یا رفتار پیش‌فرض) استفاده خواهد شد."
        confirmLabel="حذف"
        busy={busy}
        onConfirm={() => submit("DELETE", { key: row.key }, "حذف شد.")}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

type PaymentSettingRow = {
  key: string;
  label: string;
  description: string;
  unit: string;
  value: number;
  isDefault: boolean;
  min: number;
  max: number;
  updatedAt: string | null;
  updatedByMobile: string | null;
};

function PaymentSettingsSection() {
  const [rows, setRows] = useState<PaymentSettingRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/admin/payment-settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت تنظیمات پرداخت.");
      const list: PaymentSettingRow[] = json.settings;
      setRows(list);
      setDraft(Object.fromEntries(list.map((r) => [r.key, String(r.value)])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت تنظیمات پرداخت.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!rows) return;
    setError(null);
    setOk(false);

    const fields: { key: string; value: number }[] = [];
    for (const row of rows) {
      const raw = (draft[row.key] ?? "").trim();
      const value = Number(raw);
      if (raw === "" || !Number.isInteger(value)) {
        setError(`«${row.label}» باید عدد صحیح باشد.`);
        return;
      }
      if (value < row.min || value > row.max) {
        setError(`«${row.label}» باید عددی بین ${row.min} و ${row.max} باشد.`);
        return;
      }
      fields.push({ key: row.key, value });
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/payment-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در ذخیره‌ی تنظیمات پرداخت.");
      setOk(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره‌ی تنظیمات پرداخت.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-10">
      <h2 className="font-display font-bold text-[1.05rem] mb-1">تنظیمات پرداخت</h2>
      <p className="text-dim text-[.8rem] mb-3 leading-relaxed">
        این درصدها روی قیمت سفارش اعمال می‌شوند و بلافاصله روی قیمت‌های بعدی اثر می‌گذارند.
        هیچ‌وقت به کاربر نمایش داده نمی‌شوند؛ کاربر فقط قیمت نهایی را می‌بیند.
      </p>

      {!rows && !error && <div className="text-dim text-[.85rem]">در حال بارگذاری…</div>}

      {rows && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((row) => (
            <div
              key={row.key}
              className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4 sm:p-5"
            >
              <div className="font-bold text-[.95rem] mb-1">{row.label}</div>
              <p className="text-dim text-[.8rem] leading-relaxed mb-3">{row.description}</p>

              {row.updatedAt && (
                <div className="text-[.72rem] text-dim mb-3">
                  آخرین به‌روزرسانی: {toJalaliDateTime(row.updatedAt)}
                  {row.updatedByMobile ? ` توسط ${row.updatedByMobile}` : ""}
                </div>
              )}
              {row.isDefault && (
                <div className="text-[.72rem] text-dim mb-3">مقدار پیش‌فرض (هنوز تغییر نکرده)</div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={row.min}
                  max={row.max}
                  value={draft[row.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                  className="flex-1 min-w-0 bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition"
                />
                <span className="text-dim text-[.8rem] shrink-0">{row.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary2 text-white text-[.85rem] font-bold disabled:opacity-50 transition"
          >
            {busy ? "در حال ذخیره…" : "ذخیره‌ی تنظیمات پرداخت"}
          </button>
          {error && <span className="text-danger text-[.78rem]">{error}</span>}
          {ok && !error && <span className="text-success text-[.78rem]">ذخیره شد.</span>}
        </div>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [rows, setRows] = useState<SettingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت تنظیمات.");
      setRows(json.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت تنظیمات.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const groups = Array.from(new Set((rows ?? []).map((r) => r.group)));

  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Settings</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">تنظیمات</h1>
        <p className="text-dim text-[.85rem] mt-1">
          مقدار کلیدهای حساس بعد از ذخیره هرگز نمایش داده نمی‌شود؛ فقط وضعیت «تنظیم شده / نشده» دیده می‌شود.
        </p>
      </div>

      <PaymentSettingsSection />

      <h2 className="font-display text-[1.2rem] font-extrabold mb-4">تنظیمات حساس</h2>

      {error && (
        <div className="bg-[rgb(var(--c-danger)/.1)] border border-[rgb(var(--c-danger)/.3)] text-danger rounded-xl px-4 py-3 text-[.85rem] mb-5">
          {error}
        </div>
      )}

      {!rows && !error && <div className="text-dim text-[.85rem]">در حال بارگذاری…</div>}

      {rows &&
        groups.map((group) => (
          <div key={group} className="mb-7">
            <h2 className="font-display font-bold text-[1.05rem] mb-3">{GROUP_LABELS[group] ?? group}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rows
                .filter((r) => r.group === group)
                .map((r) => (
                  <SettingCard key={r.key} row={r} onSaved={load} />
                ))}
            </div>
          </div>
        ))}
    </div>
  );
}
