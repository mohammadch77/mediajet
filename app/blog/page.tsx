import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import BlogHero from "@/components/blog/BlogHero";
import BlogListView from "@/components/blog/BlogListView";
import JsonLd from "@/components/JsonLd";
import { getAllContent } from "@/lib/content";
import { headerNavItems } from "@/lib/legal";
import { listPublishedBlogPosts, countPublishedByCategory, BLOG_PAGE_SIZE } from "@/lib/blogPosts";
import { SITE_URL, absoluteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

const TITLE = "وبلاگ گت‌استوک | راهنمای خرید فایل از سایت‌های استوک";
const DESCRIPTION =
  "مقاله‌های کاربردی درباره‌ی خرید تک‌فایل از سایت‌های استوک، انتخاب فرمت و لایسنس و ترفندهای طراحی و تولید محتوا؛ بدون اشتراک ماهانه و با پرداخت ریالی.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: { type: "website", locale: "fa_IR", url: `${SITE_URL}/blog`, title: TITLE, description: DESCRIPTION },
};

export default async function BlogListPage({ searchParams }: { searchParams: { page?: string } }) {
  const content = await getAllContent();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const [{ posts, total }, counts] = await Promise.all([listPublishedBlogPosts(page), countPublishedByCategory()]);
  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body flex flex-col">
      <SiteNav navItems={headerNavItems(content)} withAuthModal />
      <BlogHero
        title="وبلاگ گت‌استوک"
        intro="راهنمای عملی برای کسی که فایل استوک لازم دارد: چطور سایت و فرمت مناسب را انتخاب کنی، به لایسنس توجه کنی و فایل را بدون اشتراک ماهانه بگیری."
        crumbs={[{ label: "گت‌استوک", href: "/" }, { label: "وبلاگ" }]}
      />
      <main id="main" className="flex-1">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Blog",
                name: "وبلاگ گت‌استوک",
                url: `${SITE_URL}/blog`,
                inLanguage: "fa-IR",
                description: DESCRIPTION,
                blogPost: posts.map((p) => ({
                  "@type": "BlogPosting",
                  headline: p.title,
                  url: `${SITE_URL}/blog/${p.slug}`,
                  ...(p.coverImage ? { image: absoluteUrl(p.coverImage) } : {}),
                  ...(p.publishedAt ? { datePublished: p.publishedAt.toISOString() } : {}),
                })),
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "گت‌استوک", item: SITE_URL },
                  { "@type": "ListItem", position: 2, name: "وبلاگ", item: `${SITE_URL}/blog` },
                ],
              },
            ],
          }}
        />
        <BlogListView posts={posts} counts={counts} page={page} totalPages={totalPages} basePath="/blog" />
      </main>
      <SiteFooter content={content} />
    </div>
  );
}
