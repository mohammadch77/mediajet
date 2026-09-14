"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";

type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  updatedAt: string;
};

export default function AdminBlogList() {
  const [posts, setPosts] = useState<BlogPostRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/admin/blog");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت نوشته‌ها.");
      setPosts(json.posts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت نوشته‌ها.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: newSlug.trim(), title: newTitle.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در ساخت نوشته.");
      setNewSlug("");
      setNewTitle("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در ساخت نوشته.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Blog</div>
        <h1 className="font-display text-[clamp(1.5rem,3.5vw,2.1rem)] font-extrabold mt-2">مدیریت وبلاگ</h1>
        <p className="text-dim text-[.85rem] mt-1">نوشته‌های وبلاگ را بساز، ویرایش و منتشر کن.</p>
      </div>

      {error && (
        <div className="bg-[rgba(255,107,107,.1)] border border-[rgba(255,107,107,.3)] text-[#ff6b6b] rounded-xl px-4 py-3 text-[.85rem] mb-5">
          {error}
        </div>
      )}

      <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-4 sm:p-5 mb-5">
        <h2 className="font-display font-bold text-[.95rem] mb-3">نوشته‌ی جدید</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="نامک (slug) — فقط حروف انگلیسی کوچک، عدد و خط تیره"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            dir="ltr"
            className="flex-1 bg-[rgba(0,0,0,.25)] border border-[rgba(138,124,255,.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition"
          />
          <input
            type="text"
            placeholder="عنوان نوشته"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 bg-[rgba(0,0,0,.25)] border border-[rgba(138,124,255,.2)] rounded-xl px-3.5 py-2.5 text-[.85rem] outline-none focus:border-primary transition"
          />
          <button
            onClick={create}
            disabled={creating || !newSlug.trim() || !newTitle.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-br from-primary to-primary2 text-white text-[.85rem] font-bold disabled:opacity-50 transition whitespace-nowrap"
          >
            {creating ? "در حال ساخت…" : "ساخت نوشته"}
          </button>
        </div>
      </div>

      {!posts && !error && <div className="text-dim text-[.85rem]">در حال بارگذاری…</div>}

      {posts && (
        <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[.85rem] min-w-[560px]">
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
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-dim">
                      هنوز نوشته‌ای ساخته نشده.
                    </td>
                  </tr>
                )}
                {posts.map((p) => (
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
                    <td className="px-4 py-3 text-left">
                      <Link
                        href={`/admin/blog/${p.slug}`}
                        className="px-3 py-1.5 rounded-lg bg-[rgba(138,124,255,.14)] text-primary font-bold text-[.78rem] hover:bg-[rgba(138,124,255,.22)] transition"
                      >
                        ویرایش
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
