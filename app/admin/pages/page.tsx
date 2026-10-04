"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type PageRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  updatedAt: string;
};

export default function AdminPagesList() {
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PageRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug.trim(), title: newTitle.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در ساخت صفحه.");
      setNewSlug("");
      setNewTitle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ساخت صفحه.");
    } finally {
      setCreating(false);
    }
  }

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/admin/pages");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت صفحات.");
      setPages(json.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت صفحات.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pages/${pendingDelete.slug}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در حذف صفحه.");
      setPendingDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در حذف صفحه.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Pages</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">مدیریت صفحات متن‌آزاد</h1>
        <p className="text-dim text-[.85rem] mt-1">
          صفحاتی مثل درباره ما، قوانین و مقررات و سؤالات متداول را ویرایش و منتشر کن.
        </p>
      </div>

      {error && (
        <div className="bg-[rgb(var(--c-danger)/.1)] border border-[rgb(var(--c-danger)/.3)] text-danger rounded-xl px-4 py-3 text-[.85rem] mb-5">
          {error}
        </div>
      )}

      <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4 sm:p-5 mb-5">
        <h2 className="font-display font-bold text-[.95rem] mb-1">صفحه‌ی جدید</h2>
        <p className="text-dim text-[.78rem] mb-3">
          برای لینک‌های فوتر از نامک‌های about، terms و faq استفاده کن (آدرس: /p/about و ...).
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="نامک (slug) — فقط حروف انگلیسی کوچک، عدد و خط تیره"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            dir="ltr"
            className="flex-1 bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition"
          />
          <input
            type="text"
            placeholder="عنوان صفحه"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition"
          />
          <button
            onClick={create}
            disabled={creating || !newSlug.trim() || !newTitle.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary2 text-white font-bold text-[.85rem] disabled:opacity-50 transition"
          >
            {creating ? "در حال ساخت…" : "ساخت صفحه"}
          </button>
        </div>
      </div>

      {!pages && !error && <div className="text-dim text-[.85rem]">در حال بارگذاری…</div>}

      {pages && (
        <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[.85rem] min-w-[640px]">
              <thead>
                <tr className="text-dim text-[.75rem] border-b border-[rgb(var(--c-primary2)/.14)]">
                  <th className="text-right px-4 py-3 font-semibold">عنوان</th>
                  <th className="text-right px-4 py-3 font-semibold">نامک</th>
                  <th className="text-right px-4 py-3 font-semibold">وضعیت</th>
                  <th className="text-right px-4 py-3 font-semibold">آخرین به‌روزرسانی</th>
                  <th className="text-right px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id} className="border-b border-[rgb(var(--c-primary2)/.08)] last:border-0">
                    <td className="px-4 py-3 font-bold">{p.title}</td>
                    <td className="px-4 py-3 text-dim latin" dir="ltr">/{p.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "px-2.5 py-1 rounded-full text-[.72rem] font-bold " +
                          (p.published
                            ? "bg-[rgb(var(--c-success)/.14)] text-success"
                            : "bg-[rgb(var(--c-ov)/.08)] text-dim")
                        }
                      >
                        {p.published ? "منتشرشده" : "پیش‌نویس"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dim">{toJalaliDateTime(p.updatedAt)}</td>
                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <Link
                        href={`/admin/pages/${p.slug}`}
                        className="px-3 py-1.5 rounded-lg bg-[rgb(var(--c-primary2)/.14)] text-primary font-bold text-[.78rem] hover:bg-[rgb(var(--c-primary2)/.22)] transition ml-2"
                      >
                        ویرایش
                      </Link>
                      <button
                        onClick={() => setPendingDelete(p)}
                        className="px-3 py-1.5 rounded-lg bg-[rgb(var(--c-danger)/.1)] text-danger font-bold text-[.78rem] hover:bg-[rgb(var(--c-danger)/.18)] transition"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="حذف صفحه"
        message={`آیا از حذف صفحه‌ی «${pendingDelete?.title}» مطمئنی؟ این عملیات غیرقابل بازگشت است.`}
        confirmLabel="حذف صفحه"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
