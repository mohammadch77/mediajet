"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { toJalaliDateTime } from "@/lib/jalali";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="text-dim text-[.85rem] px-4 py-3">در حال بارگذاری ویرایشگر…</div>,
});

type PageData = {
  slug: string;
  title: string;
  contentHtml: string;
  published: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: string;
  updatedBy: string;
};

export default function AdminPageEditor() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [page, setPage] = useState<PageData | null>(null);
  const [title, setTitle] = useState("");
  const [contentHtml, setContentHtml] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setError(null);
      setNotFound(false);
      try {
        const res = await fetch(`/api/admin/pages/${slug}`);
        const json = await res.json();
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(json.error ?? "خطا در دریافت صفحه.");
        const p: PageData = json.page;
        setPage(p);
        setTitle(p.title);
        setContentHtml(p.contentHtml);
        setMetaTitle(p.metaTitle ?? "");
        setMetaDescription(p.metaDescription ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطا در دریافت صفحه.");
      }
    })();
  }, [slug]);

  async function save(publish: boolean) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch(`/api/admin/pages/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contentHtml,
          published: publish,
          metaTitle,
          metaDescription,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در ذخیره‌ی صفحه.");
      setPage(json.page);
      setOk(publish ? "صفحه منتشر شد." : "پیش‌نویس ذخیره شد.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ذخیره‌ی صفحه.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pages/${slug}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در حذف صفحه.");
      router.push("/admin/pages");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در حذف صفحه.");
      setDeleting(false);
    }
  }

  if (notFound) {
    return (
      <div>
        <div className="text-dim text-[.85rem] mb-4">صفحه‌ای با این نامک پیدا نشد.</div>
        <Link href="/admin/pages" className="text-primary font-bold text-[.85rem]">
          ← بازگشت به لیست صفحات
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/admin/pages" className="text-dim text-[.78rem] hover:text-text transition">
            ← لیست صفحات
          </Link>
          <h1 className="font-display text-[clamp(1.3rem,3vw,1.8rem)] font-extrabold mt-2">
            ویرایش «{page?.title ?? slug}»
          </h1>
          {page && (
            <p className="text-dim text-[.78rem] mt-1">
              آخرین به‌روزرسانی: {toJalaliDateTime(page.updatedAt)}
              {" · "}
              <span
                className={page.published ? "text-success" : "text-dim"}
              >
                {page.published ? "منتشرشده" : "پیش‌نویس"}
              </span>
            </p>
          )}
        </div>
        {page && (
          <a
            href={`/p/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan text-[.8rem] font-bold hover:underline"
          >
            مشاهده در سایت ↗
          </a>
        )}
      </div>

      {error && (
        <div className="bg-[rgb(var(--c-danger)/.1)] border border-[rgb(var(--c-danger)/.3)] text-danger rounded-xl px-4 py-3 text-[.85rem] mb-5">
          {error}
        </div>
      )}

      {!page && !error && <div className="text-dim text-[.85rem]">در حال بارگذاری…</div>}

      {page && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4 sm:p-5">
            <label className="block text-[.8rem] font-bold mb-1.5">عنوان صفحه</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition mb-4"
            />

            <label className="block text-[.8rem] font-bold mb-1.5">محتوا</label>
            <RichTextEditor key={slug} value={contentHtml} onChange={setContentHtml} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4 sm:p-5">
              <h2 className="font-display font-bold text-[.95rem] mb-3">سئو</h2>
              <label className="block text-[.78rem] font-bold mb-1.5">عنوان متا (metaTitle)</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.82rem] outline-none focus:border-primary transition mb-3"
              />
              <label className="block text-[.78rem] font-bold mb-1.5">توضیحات متا (metaDescription)</label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={3}
                className="w-full bg-[rgb(var(--c-sink)/.25)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-3.5 py-2.5 text-[.82rem] outline-none focus:border-primary transition resize-y"
              />
            </div>

            <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-4 sm:p-5 flex flex-col gap-2.5">
              <button
                onClick={() => save(true)}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary2 text-white text-[.85rem] font-bold disabled:opacity-50 transition"
              >
                {busy ? "در حال ذخیره…" : "ذخیره و انتشار"}
              </button>
              <button
                onClick={() => save(false)}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-[rgb(var(--c-ov)/.06)] text-text text-[.85rem] font-bold disabled:opacity-50 transition"
              >
                ذخیره به‌عنوان پیش‌نویس
              </button>
              {ok && !error && <div className="text-success text-[.78rem]">{ok}</div>}
            </div>

            <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-danger)/.2)] rounded-2xl p-4 sm:p-5">
              <h2 className="font-display font-bold text-[.9rem] mb-2 text-danger">منطقه‌ی خطر</h2>
              <p className="text-dim text-[.78rem] mb-3">حذف صفحه غیرقابل بازگشت است.</p>
              <button
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={busy}
                className="w-full px-4 py-2.5 rounded-xl bg-[rgb(var(--c-danger)/.1)] text-danger text-[.85rem] font-bold hover:bg-[rgb(var(--c-danger)/.18)] disabled:opacity-50 transition"
              >
                حذف صفحه
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="حذف صفحه"
        message={`آیا از حذف صفحه‌ی «${page?.title ?? slug}» مطمئنی؟ این عملیات غیرقابل بازگشت است.`}
        confirmLabel="حذف صفحه"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
