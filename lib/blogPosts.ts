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
  pageSize: number = BLOG_PAGE_SIZE
): Promise<{ posts: BlogPost[]; total: number }> {
  const where = { published: true };
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
  authorId: string
): Promise<BlogPost> {
  return prisma.blogPost.create({
    data: {
      slug,
      title,
      contentHtml: "",
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
    published: boolean;
    metaTitle?: string;
    metaDescription?: string;
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
      published: data.published,
      publishedAt,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
    },
  });
}
