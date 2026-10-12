// دسترسی به نوشته‌های وبلاگ.

import { prisma } from "./db";
import { sanitizeHtml } from "./sanitize";
import type { BlogPost } from "@prisma/client";

export const BLOG_PAGE_SIZE = 9;

export async function listBlogPosts(): Promise<BlogPost[]> {
  return prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  return prisma.blogPost.findUnique({ where: { slug } });
}

/** فقط برای رندر عمومی: اگر نوشته وجود نداشت یا منتشر نشده بود، null. */
export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) {
    return null;
  }
  return post;
}

export async function listPublishedBlogPosts(
  page: number,
  pageSize: number = BLOG_PAGE_SIZE,
  category?: string
): Promise<{ posts: BlogPost[]; total: number }> {
  const where = category ? { published: true, category } : { published: true };
  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.blogPost.count({ where }),
  ]);
  return { posts, total };
}

export async function createBlogPost(
  slug: string,
  title: string,
  authorId: string,
  contentHtml = ""
): Promise<BlogPost> {
  return prisma.blogPost.create({
    data: {
      slug,
      title,
      contentHtml: contentHtml ? sanitizeHtml(contentHtml) : "",
      published: false,
      authorId,
    },
  });
}

export async function deleteBlogPost(slug: string): Promise<void> {
  await prisma.blogPost.delete({ where: { slug } });
}

export async function updateBlogPost(
  slug: string,
  data: {
    title: string;
    excerpt?: string;
    contentHtml: string;
    coverImage?: string;
    category?: string;
    tags?: string[];
    published: boolean;
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
  },
  existing: BlogPost
): Promise<BlogPost> {
  // publishedAt فقط اولین بار که پست منتشر می‌شود ثبت می‌شود؛ ویرایش‌های بعدی آن را عوض نمی‌کند
  // مگر اینکه پست دوباره از پیش‌نویس به منتشرشده برگردد.
  const publishedAt = data.published ? (existing.publishedAt ?? new Date()) : existing.publishedAt;

  return prisma.blogPost.update({
    where: { slug },
    data: {
      title: data.title,
      excerpt: data.excerpt || null,
      contentHtml: sanitizeHtml(data.contentHtml),
      coverImage: data.coverImage || null,
      // اگر فرم دسته/برچسب نفرستاد (undefined)، مقدار فعلی دست‌نخورده می‌ماند.
      ...(data.category !== undefined ? { category: data.category || null } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      published: data.published,
      publishedAt,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      focusKeyword: data.focusKeyword || null,
    },
  });
}

/** تعداد نوشته‌های منتشرشده‌ی هر دسته (کلید = slug دسته). */
export async function countPublishedByCategory(): Promise<Record<string, number>> {
  const rows = await prisma.blogPost.groupBy({ by: ["category"], where: { published: true }, _count: { _all: true } });
  const out: Record<string, number> = {};
  for (const r of rows) if (r.category) out[r.category] = r._count._all;
  return out;
}

/** نوشته‌های مرتبط: اول هم‌دسته، بعد جدیدترین‌ها؛ خودِ نوشته حذف می‌شود. */
export async function listRelatedBlogPosts(post: { id: string; category: string | null }, take = 3): Promise<BlogPost[]> {
  const same = post.category
    ? await prisma.blogPost.findMany({
        where: { published: true, category: post.category, NOT: { id: post.id } },
        orderBy: { publishedAt: "desc" },
        take,
      })
    : [];
  if (same.length >= take) return same;
  const others = await prisma.blogPost.findMany({
    where: { published: true, NOT: { id: { in: [post.id, ...same.map((p) => p.id)] } } },
    orderBy: { publishedAt: "desc" },
    take: take - same.length,
  });
  return [...same, ...others];
}

/** زمان مطالعه‌ی تقریبی (دقیقه) از روی تعداد واژه‌ها؛ ۲۰۰ واژه در دقیقه. */
export function readingMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
