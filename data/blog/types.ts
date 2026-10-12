import type { BlogCategorySlug } from "@/lib/blogCategories";

/** یک مقاله‌ی آماده برای seed. contentHtml فقط از تگ‌های مجاز sanitize استفاده می‌کند (h2/h3/p/ul/ol/li/a/blockquote/strong/em/table…). */
export type BlogSeed = {
  slug: string;
  title: string;
  excerpt: string;
  /** کلیدواژه‌ی کانونی؛ باید در عنوان، متا، خلاصه، پاراگراف اول و یک h2 بیاید (lib/seoCheck.ts). */
  focusKeyword: string;
  category: BlogCategorySlug;
  tags: string[];
  metaTitle: string;
  metaDescription: string;
  coverImage: string;
  /** فاصله‌ی روز از «الان» برای تاریخ انتشار؛ تا مقاله‌ها همه یک‌روزه منتشر نشوند. */
  publishedDaysAgo: number;
  contentHtml: string;
};
