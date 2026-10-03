// دسترسی به صفحات متن‌آزاد سایت (درباره ما، قوانین و مقررات، سؤالات متداول و مشابه).

import { prisma } from "./db";
import { sanitizeHtml } from "./sanitize";
import type { Page } from "@prisma/client";

export const DEFAULT_PAGES: { slug: string; title: string; contentHtml: string }[] = [
  {
    slug: "about",
    title: "درباره ما",
    contentHtml: "<h2>درباره گت‌استوک</h2><p>این متن پیش‌فرض صفحه‌ی «درباره ما» است. از پنل ادمین ویرایش کنید.</p>",
  },
  {
    slug: "terms",
    title: "قوانین و مقررات",
    contentHtml: "<h2>قوانین و مقررات</h2><p>این متن پیش‌فرض صفحه‌ی «قوانین و مقررات» است. از پنل ادمین ویرایش کنید.</p>",
  },
  {
    slug: "faq",
    title: "سؤالات متداول",
    contentHtml: "<h2>سؤالات متداول</h2><p>این متن پیش‌فرض صفحه‌ی «سؤالات متداول» است. از پنل ادمین ویرایش کنید.</p>",
  },
];

export async function listPages(): Promise<Page[]> {
  return prisma.page.findMany({ orderBy: { slug: "asc" } });
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  return prisma.page.findUnique({ where: { slug } });
}

/** فقط برای رندر عمومی: اگر صفحه وجود نداشت یا منتشر نشده بود، null. */
export async function getPublishedPageBySlug(slug: string): Promise<Page | null> {
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page || !page.published) {
    return null;
  }
  return page;
}

export async function createPage(
  slug: string,
  title: string,
  updatedBy: string
): Promise<Page> {
  return prisma.page.create({
    data: {
      slug,
      title,
      contentHtml: "",
      published: false,
      updatedBy,
    },
  });
}

export async function deletePage(slug: string): Promise<void> {
  await prisma.page.delete({ where: { slug } });
}

export async function updatePage(
  slug: string,
  data: {
    title: string;
    contentHtml: string;
    published: boolean;
    metaTitle?: string;
    metaDescription?: string;
  },
  updatedBy: string
): Promise<Page> {
  return prisma.page.update({
    where: { slug },
    data: {
      title: data.title,
      contentHtml: sanitizeHtml(data.contentHtml),
      published: data.published,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      updatedBy,
    },
  });
}
