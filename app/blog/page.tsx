import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedBlogPosts, BLOG_PAGE_SIZE } from "@/lib/blogPosts";
import { toJalaliDate } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "وبلاگ گت‌استوک",
  description: "آخرین مقالات و اخبار گت‌استوک.",
  openGraph: {
    title: "وبلاگ گت‌استوک",
    description: "آخرین مقالات و اخبار گت‌استوک.",
    type: "website",
  },
};

export default async function BlogListPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const { posts, total } = await listPublishedBlogPosts(page);
  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body">
      <div className="max-w-[960px] mx-auto px-[5vw] py-14">
        <Link href="/" className="latin text-[.75rem] tracking-[.14em] uppercase text-cyan font-bold">
          ← گت‌استوک
        </Link>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-4 mb-8">وبلاگ</h1>

        {posts.length === 0 && (
          <div className="text-dim text-[.9rem]">هنوز نوشته‌ای منتشر نشده است.</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl overflow-hidden hover:border-[rgba(138,124,255,.35)] transition"
            >
              {post.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-[180px] object-cover"
                />
              )}
              <div className="p-4 sm:p-5">
                <h2 className="font-display font-bold text-[1.05rem] group-hover:text-primary transition">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="text-dim text-[.85rem] mt-2 leading-[1.8] line-clamp-2">{post.excerpt}</p>
                )}
                <p className="text-[#5b6390] text-[.75rem] mt-3">
                  {post.publishedAt ? toJalaliDate(post.publishedAt) : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            {page > 1 && (
              <Link
                href={`/blog?page=${page - 1}`}
                className="px-4 py-2 rounded-xl bg-[rgba(255,255,255,.06)] text-text text-[.82rem] font-bold hover:bg-[rgba(255,255,255,.1)] transition"
              >
                قبلی
              </Link>
            )}
            <span className="text-dim text-[.82rem]">
              صفحه {page} از {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/blog?page=${page + 1}`}
                className="px-4 py-2 rounded-xl bg-[rgba(255,255,255,.06)] text-text text-[.82rem] font-bold hover:bg-[rgba(255,255,255,.1)] transition"
              >
                بعدی
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
