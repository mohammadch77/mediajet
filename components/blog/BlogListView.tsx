import Link from "next/link";
import BlogCard from "@/components/blog/BlogCard";
import BlogCta from "@/components/blog/BlogCta";
import { BLOG_CATEGORIES } from "@/lib/blogCategories";
import { toPersianDigits } from "@/lib/money";

type Post = Parameters<typeof BlogCard>[0]["post"] & { id: string };

/** لیست نوشته‌ها (برای /blog و /blog/category/:slug): فیلتر دسته، نوشته‌ی ویژه، شبکه‌ی کارت‌ها و صفحه‌بندی. */
export default function BlogListView({
  posts,
  counts,
  active,
  page,
  totalPages,
  basePath,
}: {
  posts: Post[];
  counts: Record<string, number>;
  active?: string;
  page: number;
  totalPages: number;
  basePath: string;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const chip = (on: boolean) =>
    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[.84rem] font-bold border transition " +
    (on
      ? "bg-gradient-to-r from-primary to-primary-deep text-on-solid border-transparent"
      : "text-dim border-[rgb(var(--c-primary2)/.28)] hover:text-text hover:border-[rgb(var(--c-primary2)/.55)]");
  const [first, ...rest] = posts;
  const showFeatured = page === 1 && !!first;

  return (
    <div className="mx-auto max-w-[1100px] px-[5vw] py-10 sm:py-14">
      <nav aria-label="دسته‌های وبلاگ" className="flex flex-wrap gap-2 mb-10">
        <Link href="/blog" aria-current={!active ? "page" : undefined} className={chip(!active)}>
          همه <span className="opacity-70 font-medium">{toPersianDigits(total)}</span>
        </Link>
        {BLOG_CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/blog/category/${c.slug}`} aria-current={active === c.slug ? "page" : undefined} className={chip(active === c.slug)}>
            <span aria-hidden>{c.icon}</span> {c.short}
            {counts[c.slug] ? <span className="opacity-70 font-medium">{toPersianDigits(counts[c.slug])}</span> : null}
          </Link>
        ))}
      </nav>

      {posts.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[rgb(var(--c-primary2)/.3)] p-10 text-center text-dim">
          هنوز نوشته‌ای در این بخش منتشر نشده است.
        </div>
      ) : (
        <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-5 items-stretch">
          {showFeatured && (
            <li className="col-span-full grid"><BlogCard post={first} featured priority /></li>
          )}
          {(showFeatured ? rest : posts).map((p) => (
            <li key={p.id} className="grid"><BlogCard post={p} /></li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-3 mt-12">
          {page > 1 && <Link href={page - 1 === 1 ? basePath : `${basePath}?page=${page - 1}`} rel="prev" className={chip(false)}>→ قبلی</Link>}
          <span className="text-dim text-[.85rem]">صفحه‌ی {toPersianDigits(page)} از {toPersianDigits(totalPages)}</span>
          {page < totalPages && <Link href={`${basePath}?page=${page + 1}`} rel="next" className={chip(false)}>بعدی ←</Link>}
        </nav>
      )}

      <div className="mt-14"><BlogCta /></div>
    </div>
  );
}
