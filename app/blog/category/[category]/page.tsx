import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import BlogHero from "@/components/blog/BlogHero";
import BlogListView from "@/components/blog/BlogListView";
import JsonLd from "@/components/JsonLd";
import { getAllContent } from "@/lib/content";
import { headerNavItems } from "@/lib/legal";
import { blogCategory } from "@/lib/blogCategories";
import { listPublishedBlogPosts, countPublishedByCategory, parseBlogQuery, BLOG_PAGE_SIZE } from "@/lib/blogPosts";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: { params: { category: string }; searchParams: { page?: string; sort?: string; q?: string } }): Promise<Metadata> {
  const { sort, q, page } = parseBlogQuery(searchParams);
  const cat = blogCategory(params.category);
  if (!cat) return {};
  const url = `${SITE_URL}/blog/category/${cat.slug}`;
  return {
    title: cat.metaTitle,
    description: cat.metaDescription,
    alternates: { canonical: page > 1 ? `${url}?page=${page}` : url },
    ...(q || sort !== "new" ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: "website", locale: "fa_IR", url, title: cat.metaTitle, description: cat.metaDescription },
  };
}

export default async function BlogCategoryPage({ params, searchParams }: { params: { category: string }; searchParams: { page?: string; sort?: string; q?: string } }) {
  const cat = blogCategory(params.category);
  if (!cat) notFound();
  const content = await getAllContent();
  const { sort, q, page } = parseBlogQuery(searchParams);
  const [{ posts, total }, counts] = await Promise.all([listPublishedBlogPosts(page, BLOG_PAGE_SIZE, { category: cat.slug, sort, q }), countPublishedByCategory()]);
  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  if (page > totalPages) redirect(totalPages > 1 ? `/blog/category/${cat.slug}?${new URLSearchParams({ ...(q ? { q } : {}), ...(sort !== "new" ? { sort } : {}), page: String(totalPages) })}` : `/blog/category/${cat.slug}`);

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body flex flex-col">
      <SiteNav navItems={headerNavItems(content)} withAuthModal />
      <BlogHero
        title={cat.title}
        intro={cat.description}
        crumbs={[{ label: "گت‌استوک", href: "/" }, { label: "وبلاگ", href: "/blog" }, { label: cat.title }]}
      />
      <main id="main" className="flex-1">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "گت‌استوک", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "وبلاگ", item: `${SITE_URL}/blog` },
              { "@type": "ListItem", position: 3, name: cat.title, item: `${SITE_URL}/blog/category/${cat.slug}` },
            ],
          }}
        />
        <BlogListView posts={posts} counts={counts} active={cat.slug} page={page} totalPages={totalPages} total={total} basePath={`/blog/category/${cat.slug}`} sort={sort} q={q} />
      </main>
      <SiteFooter content={content} />
    </div>
  );
}
