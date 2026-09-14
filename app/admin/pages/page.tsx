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
        <div className="bg-[rgba(255,107,107,.1)] border border-[rgba(255,107,107,.3)] text-[#ff6b6b] rounded-xl px-4 py-3 text-[.85rem] mb-5">
          {error}
        </div>
      )}

      {!pages && !error && <div className="text-dim text-[.85rem]">در حال بارگذاری…</div>}

      {pages && (
        <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[.85rem] min-w-[640px]">
              <thead>
                <tr className="text-dim text-[.75rem] border-b border-[rgba(138,124,255,.14)]">
                  <th className="text-right px-4 py-3 font-semibold">عنوان</th>
                  <th className="text-right px-4 py-3 font-semibold">نامک</th>
                  <th className="text-right px-4 py-3 font-semibold">وضعیت</th>
                  <th className="text-right px-4 py-3 font-semibold">آخرین به‌روزرسانی</th>
                  <th className="text-right px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id} className="border-b border-[rgba(138,124,255,.08)] last:border-0">
                    <td className="px-4 py-3 font-bold">{p.title}</td>
                    <td className="px-4 py-3 text-dim latin" dir="ltr">/{p.slug}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          "px-2.5 py-1 rounded-full text-[.72rem] font-bold " +
                          (p.published
                            ? "bg-[rgba(61,220,132,.14)] text-[#3ddc84]"
                            : "bg-[rgba(255,255,255,.08)] text-dim")
                        }
                      >
                        {p.published ? "منتشرشده" : "پیش‌نویس"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-dim">{toJalaliDateTime(p.updatedAt)}</td>
                    <td className="px-4 py-3 text-left whitespace-nowrap">
                      <Link
                        href={`/admin/pages/${p.slug}`}
                        className="px-3 py-1.5 rounded-lg bg-[rgba(138,124,255,.14)] text-primary font-bold text-[.78rem] hover:bg-[rgba(138,124,255,.22)] transition ml-2"
                      >
                        ویرایش
                      </Link>
                      <button
                        onClick={() => setPendingDelete(p)}
                        className="px-3 py-1.5 rounded-lg bg-[rgba(255,107,107,.1)] text-[#ff6b6b] font-bold text-[.78rem] hover:bg-[rgba(255,107,107,.18)] transition"
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
