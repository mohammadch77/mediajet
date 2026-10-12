import Link from "next/link";
import BlogCard from "@/components/blog/BlogCard";
import BlogCta from "@/components/blog/BlogCta";
import BlogPagination from "@/components/blog/BlogPagination";
import { BLOG_CATEGORIES, blogCategory } from "@/lib/blogCategories";
import { BLOG_SORTS, type BlogSort } from "@/lib/blogPosts";
import { toPersianDigits } from "@/lib/money";

type Post = Parameters<typeof BlogCard>[0]["post"] & { id: string };

/** آدرس لیست با پارامترهای فیلتر؛ مقدار پیش‌فرض (تازه‌ترین، صفحه‌ی ۱، بدون جست‌وجو) در آدرس نمی‌آید. */
function listHref(base: string, p: { sort?: BlogSort; q?: string; page?: number }): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.sort && p.sort !== "new") sp.set("sort", p.sort);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * لیست مقاله‌ها (برای /blog و /blog/category/:slug): جست‌وجو، مرتب‌سازی (تازه‌ترین/پربازدیدترین/قدیمی‌ترین)،
 * دسته‌ها، شبکه‌ی دو ستونه و صفحه‌بندی. همه‌چیز با لینک و فرم GET کار می‌کند (بدون نیاز به JS و قابل‌اشتراک‌گذاری).
 * موبایل: دسته‌ها یک ردیف افقی فشرده؛ دسکتاپ (lg): کارت‌های موضوعی.
 */
export default function BlogListView({
  posts,
  counts,
  active,
  page,
  totalPages,
  total,
  basePath,
  sort,
  q,
}: {
  posts: Post[];
  counts: Record<string, number>;
  active?: string;
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  sort: BlogSort;
  q: string;
}) {
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const activeCat = blogCategory(active);
  const filtered = !!q || sort !== "new" || !!active;

  const cats = [
    { key: "all", href: listHref("/blog", { sort, q }), icon: "✨", title: "همه", count: allCount, on: !active },
    ...BLOG_CATEGORIES.map((c) => ({ key: c.slug, href: listHref(`/blog/category/${c.slug}`, { sort, q }), icon: c.icon, title: c.short, count: counts[c.slug] ?? 0, on: active === c.slug })),
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-[5vw] py-8 sm:py-14">
      {/* نوار جست‌وجو و مرتب‌سازی */}
      <div className="rounded-[22px] border border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 p-3 sm:p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form method="get" action={basePath} role="search" className="flex w-full md:max-w-[26rem] gap-2">
          {sort !== "new" && <input type="hidden" name="sort" value={sort} />}
          <label className="sr-only" htmlFor="blog-q">جست‌وجو در مقاله‌ها</label>
          <input
            id="blog-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={60}
            placeholder="جست‌وجو در مقاله‌ها…"
            className="min-w-0 flex-1 rounded-xl border border-[rgb(var(--c-primary2)/.25)] bg-[rgb(var(--c-sink)/.25)] px-4 py-2.5 text-[.88rem] outline-none transition focus:border-primary"
          />
          <button type="submit" className="shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary-deep px-5 py-2.5 text-[.85rem] font-bold text-on-solid">
            جست‌وجو
          </button>
        </form>
        <div role="group" aria-label="مرتب‌سازی" className="grid grid-cols-3 gap-1 rounded-xl border border-[rgb(var(--c-primary2)/.2)] bg-[rgb(var(--c-sink)/.2)] p-1 md:flex md:shrink-0">
          {BLOG_SORTS.map((s) => (
            <Link
              key={s.key}
              href={listHref(basePath, { sort: s.key, q })}
              aria-current={sort === s.key ? "true" : undefined}
              className={
                "rounded-lg px-2 sm:px-3.5 py-2 text-center text-[.78rem] sm:text-[.84rem] font-bold whitespace-nowrap transition " +
                (sort === s.key ? "bg-gradient-to-br from-primary to-primary-deep text-on-solid shadow-sm" : "text-dim hover:text-text")
              }
            >
              <span aria-hidden>{s.icon}</span> {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* دسته‌ها: موبایل/تبلت = یک ردیف افقی فشرده */}
      <nav aria-label="دسته‌های وبلاگ" className="mt-5">
        <ul className="m-0 p-0 list-none flex gap-2 overflow-x-auto snap-x snap-proximity pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cats.map((c) => (
            <li key={c.key} className="shrink-0 snap-start">
              <Link
                href={c.href}
                aria-current={c.on ? "page" : undefined}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[.82rem] font-bold whitespace-nowrap transition " +
                  (c.on ? "border-transparent bg-gradient-to-r from-primary to-primary-deep text-on-solid" : "border-[rgb(var(--c-primary2)/.28)] text-dim hover:text-text")
                }
              >
                <span aria-hidden>{c.icon}</span> {c.title}
                <span className={"text-[.72rem] " + (c.on ? "opacity-80" : "text-muted")}>{toPersianDigits(c.count)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {/* دسکتاپ: کارت‌های موضوعی */}
        <ul className="m-0 p-0 list-none hidden lg:grid grid-cols-6 gap-3">
          {cats.map((c) => (
            <li key={c.key} className="grid">
              <Link
                href={c.href}
                aria-current={c.on ? "page" : undefined}
                className={
                  "flex flex-col items-start gap-2.5 rounded-[18px] border p-4 transition duration-200 hover:-translate-y-0.5 " +
                  (c.on
                    ? "border-[rgb(var(--c-primary2)/.75)] bg-[linear-gradient(135deg,rgb(var(--c-primary)/.22),rgb(var(--c-cyan)/.08))] shadow-[0_18px_40px_-26px_rgb(var(--c-primary))]"
                    : "border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 hover:border-[rgb(var(--c-primary2)/.5)]")
                }
              >
                <span aria-hidden className={"grid h-10 w-10 place-items-center rounded-xl border text-[1.15rem] " + (c.on ? "border-[rgb(var(--c-primary2)/.5)] bg-[rgb(var(--c-ov)/.1)]" : "border-[rgb(var(--c-ov)/.1)] bg-[rgb(var(--c-ov)/.05)]")}>{c.icon}</span>
                <span className="text-[.9rem] font-bold leading-[1.6] text-text">{c.title === "همه" ? "همه‌ی مقاله‌ها" : c.title}</span>
                <span className={"mt-auto text-[.74rem] " + (c.on ? "font-bold text-cyan" : "text-muted")}>{c.count ? `${toPersianDigits(c.count)} مقاله` : "به‌زودی"}</span>
              </Link>
            </li>
          ))}
        </ul>
        {activeCat && (
          <p className="mt-4 mb-0 rounded-2xl border border-[rgb(var(--c-primary2)/.2)] bg-[rgb(var(--c-ov)/.03)] px-4 py-3 text-[.86rem] leading-[2] text-dim">
            <strong className="text-text">{activeCat.title}:</strong> {activeCat.description}
          </p>
        )}
      </nav>

      {/* خلاصه‌ی نتیجه */}
      <div className="mt-7 mb-4 flex flex-wrap items-center justify-between gap-2 text-[.82rem] text-muted" aria-live="polite">
        <span>
          {q ? (
            <>
              {toPersianDigits(total)} نتیجه برای «<strong className="text-text">{q}</strong>»
            </>
          ) : (
            <>{toPersianDigits(total)} مقاله</>
          )}
        </span>
        {filtered && (
          <Link href="/blog" className="font-bold text-cyan hover:underline">
            پاک‌کردن فیلترها ✕
          </Link>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-[rgb(var(--c-primary2)/.3)] p-10 text-center text-dim">
          {q ? "مقاله‌ای با این جست‌وجو پیدا نشد؛ عبارت دیگری امتحان کن یا فیلترها را پاک کن." : "هنوز نوشته‌ای در این بخش منتشر نشده است."}
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

      <BlogPagination page={page} totalPages={totalPages} hrefFor={(n) => listHref(basePath, { sort, q, page: n })} />

      <div className="mt-14"><BlogCta /></div>
    </div>
  );
}
