import Link from "next/link";
import BlogCard from "@/components/blog/BlogCard";
import BlogCta from "@/components/blog/BlogCta";
import { BLOG_CATEGORIES, blogCategory } from "@/lib/blogCategories";
import { toPersianDigits } from "@/lib/money";

type Post = Parameters<typeof BlogCard>[0]["post"] & { id: string };

/** لیست نوشته‌ها (برای /blog و /blog/category/:slug): ناوبر دسته‌ها، شبکه‌ی دو ستونه‌ی کارت‌ها و صفحه‌بندی. */
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
  const activeCat = blogCategory(active);
  const pill = (on: boolean) =>
    "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[.84rem] font-bold border transition " +
    (on
      ? "bg-gradient-to-r from-primary to-primary-deep text-on-solid border-transparent"
      : "text-dim border-[rgb(var(--c-primary2)/.28)] hover:text-text hover:border-[rgb(var(--c-primary2)/.55)]");

  const tiles = [
    { key: "all", href: "/blog", icon: "✨", title: "همه‌ی مقاله‌ها", count: total, on: !active },
    ...BLOG_CATEGORIES.map((c) => ({ key: c.slug, href: `/blog/category/${c.slug}`, icon: c.icon, title: c.short, count: counts[c.slug] ?? 0, on: active === c.slug })),
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-[5vw] py-10 sm:py-14">
      <nav aria-label="دسته‌های وبلاگ">
        <div className="flex items-baseline justify-between gap-3 mb-4">
          <h2 className="m-0 font-display font-extrabold text-[1.05rem] sm:text-[1.2rem]">موضوع‌ها</h2>
          <span className="text-[.78rem] text-muted">{toPersianDigits(total)} مقاله در {toPersianDigits(BLOG_CATEGORIES.length)} دسته</span>
        </div>
        <ul className="m-0 p-0 list-none grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {tiles.map((t) => (
            <li key={t.key} className="grid">
              <Link
                href={t.href}
                aria-current={t.on ? "page" : undefined}
                className={
                  "group relative flex flex-col items-start gap-2.5 rounded-[18px] border p-3.5 sm:p-4 transition duration-200 hover:-translate-y-0.5 " +
                  (t.on
                    ? "border-[rgb(var(--c-primary2)/.75)] bg-[linear-gradient(135deg,rgb(var(--c-primary)/.22),rgb(var(--c-cyan)/.08))] shadow-[0_18px_40px_-26px_rgb(var(--c-primary))]"
                    : "border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 hover:border-[rgb(var(--c-primary2)/.5)]")
                }
              >
                <span
                  aria-hidden
                  className={
                    "grid h-10 w-10 place-items-center rounded-xl text-[1.15rem] border " +
                    (t.on ? "bg-[rgb(var(--c-ov)/.1)] border-[rgb(var(--c-primary2)/.5)]" : "bg-[rgb(var(--c-ov)/.05)] border-[rgb(var(--c-ov)/.1)]")
                  }
                >
                  {t.icon}
                </span>
                <span className="block text-[.86rem] sm:text-[.9rem] font-bold leading-[1.6] text-text">{t.title}</span>
                <span className={"mt-auto text-[.74rem] " + (t.on ? "text-cyan font-bold" : "text-muted")}>
                  {t.count ? `${toPersianDigits(t.count)} مقاله` : "به‌زودی"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {activeCat && (
          <p className="mt-5 mb-0 rounded-2xl border border-[rgb(var(--c-primary2)/.2)] bg-[rgb(var(--c-ov)/.03)] px-4 py-3.5 text-[.88rem] leading-[2] text-dim">
            <strong className="text-text">{activeCat.title}:</strong> {activeCat.description}
          </p>
        )}
      </nav>

      <div className="mt-10">
        {posts.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[rgb(var(--c-primary2)/.3)] p-10 text-center text-dim">
            هنوز نوشته‌ای در این بخش منتشر نشده است.
          </div>
        ) : (
          <ul className="m-0 p-0 list-none grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-stretch">
            {posts.map((p, i) => (
              <li key={p.id} className="grid">
                <BlogCard post={p} priority={i < 2} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-3 mt-12">
          {page > 1 && <Link href={page - 1 === 1 ? basePath : `${basePath}?page=${page - 1}`} rel="prev" className={pill(false)}>→ قبلی</Link>}
          <span className="text-dim text-[.85rem]">صفحه‌ی {toPersianDigits(page)} از {toPersianDigits(totalPages)}</span>
          {page < totalPages && <Link href={`${basePath}?page=${page + 1}`} rel="next" className={pill(false)}>بعدی ←</Link>}
        </nav>
      )}

      <div className="mt-14"><BlogCta /></div>
    </div>
  );
}
