import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import LegalToc from "@/components/LegalToc";
import BlogHero from "@/components/blog/BlogHero";
import BlogCard from "@/components/blog/BlogCard";
import BlogCta from "@/components/blog/BlogCta";
import BlogViewCounter from "@/components/blog/BlogViewCounter";
import JsonLd from "@/components/JsonLd";
import { getAllContent } from "@/lib/content";
import { headerNavItems } from "@/lib/legal";
import { blogCategory } from "@/lib/blogCategories";
import { getPublishedBlogPostBySlug, listRelatedBlogPosts, readingMinutes } from "@/lib/blogPosts";
import { sanitizeHtml } from "@/lib/sanitize";
import { toJalaliDate } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/money";
import { SITE_URL, absoluteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPublishedBlogPostBySlug(params.slug);
  if (!post) return {};
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || undefined;
  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = post.coverImage ? absoluteUrl(post.coverImage) : undefined;
  const keywords = seoKeywords(post);
  return {
    title,
    description,
    keywords: keywords.length ? keywords : undefined,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "article",
      locale: "fa_IR",
      url,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: ["تیم گت‌استوک"],
      tags: keywords.length ? keywords : undefined,
      images: image ? [{ url: image, width: 1200, height: 630, alt: post.title }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

/** کلیدواژه‌ها فقط برای موتورهای جست‌وجو (meta keywords / Open Graph / JSON-LD)؛ در صفحه به کاربر نمایش داده نمی‌شوند. اولی کلیدواژه‌ی کانونی است. */
function seoKeywords(post: { focusKeyword?: string | null; tags?: string[] | null }): string[] {
  return Array.from(new Set([post.focusKeyword?.trim(), ...(post.tags ?? [])].filter((v): v is string => !!v)));
}

/** به هر h2 یک id و data-toc می‌دهد (پس از sanitize، چون sanitize این اتریبیوت‌ها را حذف می‌کند) و فهرست سرفصل‌ها را برمی‌گرداند. */
function withHeadingIds(html: string): { html: string; headings: { id: string; text: string }[] } {
  const headings: { id: string; text: string }[] = [];
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const id = `s${headings.length + 1}`;
    headings.push({ id, text: inner.replace(/<[^>]+>/g, "").trim() });
    const text = headings[headings.length - 1].text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return `<h2 id="${id}" data-toc="${text}">${inner}</h2>`;
  });
  return { html: out, headings };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const content = await getAllContent();
  const post = await getPublishedBlogPostBySlug(params.slug);
  if (!post) notFound();

  // دفاع دو لایه: محتوا هنگام ذخیره sanitize شده و اینجا دوباره هم پاک‌سازی می‌شود.
  const { html } = withHeadingIds(sanitizeHtml(post.contentHtml));
  const related = await listRelatedBlogPosts(post, 3);
  const cat = blogCategory(post.category);
  const minutes = readingMinutes(post.contentHtml);
  const words = post.contentHtml.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const url = `${SITE_URL}/blog/${post.slug}`;
  const orgName = content["legal.business_name"]?.trim() || "گت‌استوک";

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body flex flex-col">
      <SiteNav navItems={headerNavItems(content)} withAuthModal />
      <BlogHero
        title={post.title}
        intro={post.excerpt ?? undefined}
        crumbs={[
          { label: "گت‌استوک", href: "/" },
          { label: "وبلاگ", href: "/blog" },
          ...(cat ? [{ label: cat.short, href: `/blog/category/${cat.slug}` }] : []),
          { label: "مقاله" },
        ]}
      >
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[.82rem] text-muted">
          {cat && (
            <Link href={`/blog/category/${cat.slug}`} className="rounded-full border border-[rgb(var(--c-primary2)/.35)] px-3 py-1 font-bold text-cyan hover:bg-[rgb(var(--c-ov)/.06)] transition">
              {cat.icon} {cat.short}
            </Link>
          )}
          {post.publishedAt && <time dateTime={post.publishedAt.toISOString()}>{toJalaliDate(post.publishedAt)}</time>}
          <span>{toPersianDigits(minutes)} دقیقه مطالعه</span>
          {post.views > 0 && <span>{toPersianDigits(post.views)} بازدید</span>}
          <span>نویسنده: تیم {orgName}</span>
        </div>
      </BlogHero>

      <main id="main" className="flex-1">
        <BlogViewCounter slug={post.slug} />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline: post.title,
                description: post.metaDescription || post.excerpt || undefined,
                inLanguage: "fa-IR",
                mainEntityOfPage: { "@type": "WebPage", "@id": url },
                url,
                ...(post.coverImage ? { image: [absoluteUrl(post.coverImage)] } : {}),
                ...(post.publishedAt ? { datePublished: post.publishedAt.toISOString() } : {}),
                dateModified: post.updatedAt.toISOString(),
                author: { "@type": "Organization", name: orgName, url: SITE_URL },
                publisher: { "@type": "Organization", name: orgName, logo: { "@type": "ImageObject", url: `${SITE_URL}/brand/logo.png` } },
                ...(cat ? { articleSection: cat.title } : {}),
                ...(seoKeywords(post).length ? { keywords: seoKeywords(post).join("، ") } : {}),
                wordCount: words,
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "گت‌استوک", item: SITE_URL },
                  { "@type": "ListItem", position: 2, name: "وبلاگ", item: `${SITE_URL}/blog` },
                  ...(cat ? [{ "@type": "ListItem", position: 3, name: cat.title, item: `${SITE_URL}/blog/category/${cat.slug}` }] : []),
                  { "@type": "ListItem", position: cat ? 4 : 3, name: post.title, item: url },
                ],
              },
            ],
          }}
        />

        <div className="mx-auto max-w-[1100px] px-[5vw] py-10 sm:py-12">
          {post.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.coverImage}
              alt={post.title}
              width={1200}
              height={630}
              fetchPriority="high"
              className="w-full aspect-[1200/630] object-cover rounded-[28px] border border-[rgb(var(--c-primary2)/.2)] shadow-[0_30px_70px_-40px_rgb(var(--c-primary))]"
            />
          )}

          <div className="mt-10 lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-12">
            <aside className="lg:sticky lg:top-24 lg:self-start space-y-5 mb-8 lg:mb-0">
              <LegalToc />
            </aside>
            <article className="min-w-0">
              <div className="legal-body prose-page prose-article max-w-[72ch]" dangerouslySetInnerHTML={{ __html: html }} />

              <BlogCta />
            </article>
          </div>

          {related.length > 0 && (
            <section aria-labelledby="related" className="mt-14">
              <h2 id="related" className="font-display font-extrabold text-[1.4rem] mb-6">مقاله‌های مرتبط</h2>
              <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-5 items-stretch">
                {related.map((p) => (
                  <li key={p.id} className="grid"><BlogCard post={p} /></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <SiteFooter content={content} />
    </div>
  );
}
