// دسترسی به نوشته‌های وبلاگ.

import { prisma } from "./db";
import { sanitizeHtml } from "./sanitize";
import type { BlogPost } from "@prisma/client";

export const BLOG_PAGE_SIZE = 10;

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

export type BlogSort = "new" | "popular" | "old";
export const BLOG_SORTS: { key: BlogSort; label: string; icon: string }[] = [
  { key: "new", label: "تازه‌ترین", icon: "✨" },
  { key: "popular", label: "پربازدیدترین", icon: "🔥" },
  { key: "old", label: "قدیمی‌ترین", icon: "⏳" },
];

/** ورودی عمومی (query string) را به مقدار امن تبدیل می‌کند: فقط کلیدهای مجاز، متن جست‌وجو حداکثر ۶۰ نویسه. */
export function parseBlogQuery(sp: { sort?: string; q?: string; page?: string }): { sort: BlogSort; q: string; page: number } {
  const sort: BlogSort = BLOG_SORTS.some((s) => s.key === sp.sort) ? (sp.sort as BlogSort) : "new";
  const q = (typeof sp.q === "string" ? sp.q : "").replace(/\s+/g, " ").trim().slice(0, 60);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  return { sort, q, page };
}

function blogWhere(category?: string, q?: string) {
  return {
    published: true,
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { excerpt: { contains: q, mode: "insensitive" as const } },
            { focusKeyword: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export async function listPublishedBlogPosts(
  page: number,
  pageSize: number = BLOG_PAGE_SIZE,
  opts: { category?: string; sort?: BlogSort; q?: string } = {}
): Promise<{ posts: BlogPost[]; total: number }> {
  const where = blogWhere(opts.category, opts.q);
  const orderBy =
    opts.sort === "popular"
      ? [{ views: "desc" as const }, { publishedAt: "desc" as const }]
      : opts.sort === "old"
        ? [{ publishedAt: "asc" as const }]
        : [{ publishedAt: "desc" as const }];
  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.blogPost.count({ where }),
  ]);
  return { posts, total };
}

/** یک بازدید به مقاله‌ی منتشرشده اضافه می‌کند (اتمیک). */
export async function incrementBlogViews(slug: string): Promise<void> {
  await prisma.blogPost.updateMany({ where: { slug, published: true }, data: { views: { increment: 1 } } });
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
