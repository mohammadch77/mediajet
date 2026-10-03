import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublishedBlogPostBySlug } from "@/lib/blogPosts";
import { sanitizeHtml } from "@/lib/sanitize";
import { toJalaliDate } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPublishedBlogPostBySlug(params.slug);
  if (!post) {
    return {};
  }
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
    },
    twitter: {
      card: post.coverImage ? "summary_large_image" : "summary",
      title,
      description,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPublishedBlogPostBySlug(params.slug);
  if (!post) {
    notFound();
  }

  // دفاع دو لایه: با اینکه محتوا موقع ذخیره sanitize شده، دوباره همین‌جا هم پاک‌سازی می‌شود.
  const safeHtml = sanitizeHtml(post.contentHtml);

  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body">
      <div className="max-w-[760px] mx-auto px-[5vw] py-14">
        <Link href="/blog" className="latin text-[.75rem] tracking-[.14em] uppercase text-cyan font-bold">
          ← وبلاگ
        </Link>
        <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-4">{post.title}</h1>
        {post.publishedAt && (
          <p className="text-muted text-[.8rem] mt-2">{toJalaliDate(post.publishedAt)}</p>
        )}
        {post.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full max-h-[420px] object-cover rounded-2xl mt-6"
          />
        )}
        <div className="prose-page mt-8" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </div>
    </div>
  );
}
