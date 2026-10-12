import Link from "next/link";
import { blogCategory } from "@/lib/blogCategories";
import { readingMinutes } from "@/lib/blogPosts";
import { toJalaliDate } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/money";

type CardPost = {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string | null;
  contentHtml: string;
  publishedAt: Date | null;
};

/** کارت یک نوشته؛ با featured=true نسخه‌ی بزرگ افقی برای نوشته‌ی اول. */
export default function BlogCard({ post, featured = false, priority = false }: { post: CardPost; featured?: boolean; priority?: boolean }) {
  const cat = blogCategory(post.category);
  const minutes = toPersianDigits(readingMinutes(post.contentHtml));
  return (
    <article className="group h-full w-full">
      <Link
        href={`/blog/${post.slug}`}
        className={
          "flex h-full overflow-hidden rounded-[26px] border border-[rgb(var(--c-primary2)/.2)] bg-gradient-to-br from-surface to-bg2 transition duration-200 hover:-translate-y-1 hover:border-[rgb(var(--c-primary2)/.5)] hover:shadow-[0_24px_50px_-30px_rgb(var(--c-primary))] " +
          (featured ? "flex-col lg:flex-row" : "flex-col")
        }
      >
        <div className={"relative shrink-0 overflow-hidden " + (featured ? "bg-[#0a0a1a] " : "bg-[rgb(var(--c-primary2)/.1)] ") + (featured ? "lg:w-[52%] aspect-[1200/630] lg:aspect-auto lg:min-h-[320px]" : "aspect-[1200/630]")}>
          {post.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImage}
              alt={post.title}
              width={1200}
              height={630}
              loading={priority ? "eager" : "lazy"}
              className={"absolute inset-0 h-full w-full transition " + (featured ? "object-cover lg:object-contain" : "object-cover") + " duration-500 group-hover:scale-[1.04]"}
            />
          ) : (
            <div aria-hidden className="absolute inset-0 grid place-items-center text-5xl">{cat?.icon ?? "📰"}</div>
          )}
          {cat && (
            <span className="absolute top-3 right-3 rounded-full bg-[rgb(var(--c-bg)/.78)] px-3 py-1 text-[.72rem] font-bold text-text backdrop-blur-md border border-[rgb(var(--c-ov)/.15)]">
              <span aria-hidden>{cat.icon}</span> {cat.short}
            </span>
          )}
        </div>
        <div className={"flex flex-1 flex-col p-5 " + (featured ? "lg:p-8 lg:justify-center" : "")}>
          <h2 className={"m-0 font-display font-extrabold leading-[1.7] text-text transition group-hover:text-cyan " + (featured ? "text-[clamp(1.2rem,2.6vw,1.65rem)]" : "text-[1.05rem]")}>{post.title}</h2>
          {post.excerpt && <p className={"text-dim leading-[2] mt-2.5 mb-0 " + (featured ? "text-[.92rem] line-clamp-4" : "text-[.85rem] line-clamp-3")}>{post.excerpt}</p>}
          <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[.75rem] text-muted">
            {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{toJalaliDate(post.publishedAt)}</time>}
            <span aria-hidden>•</span>
            <span>{minutes} دقیقه مطالعه</span>
            <span className="mr-auto text-cyan font-bold transition group-hover:-translate-x-1">بخوان ←</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
