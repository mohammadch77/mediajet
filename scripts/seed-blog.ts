// ایجاد مقاله‌های اولیه‌ی وبلاگ (idempotent: بر اساس slug؛ مقاله‌ی موجود دست نمی‌خورد).
// اجرا: npx tsx scripts/seed-blog.ts          (فقط موارد جدید)
//       npx tsx scripts/seed-blog.ts --force  (بازنویسی محتوای مقاله‌های seed با همان slug)
// نویسنده: اولین کاربر ادمین.

import { prisma } from "../lib/db";
import { sanitizeHtml } from "../lib/sanitize";
import { BLOG_SEEDS } from "../data/blogSeed";

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const force = process.argv.includes("--force");
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } });
  if (!admin) {
    console.error("هیچ کاربر ادمینی پیدا نشد. اول با scripts/promote-admin.ts یک ادمین بساز.");
    process.exitCode = 1;
    return;
  }
  for (const a of BLOG_SEEDS) {
    const data = {
      title: a.title,
      excerpt: a.excerpt,
      contentHtml: sanitizeHtml(a.contentHtml),
      coverImage: a.coverImage,
      category: a.category,
      focusKeyword: a.focusKeyword,
      tags: a.tags,
      metaTitle: a.metaTitle,
      metaDescription: a.metaDescription,
    };
    const existing = await prisma.blogPost.findUnique({ where: { slug: a.slug } });
    if (existing && !force) {
      console.log(`«${a.slug}» از قبل وجود دارد؛ رد شد.`);
      continue;
    }
    if (existing) {
      await prisma.blogPost.update({ where: { slug: a.slug }, data });
      console.log(`«${a.slug}» به‌روزرسانی شد.`);
      continue;
    }
    await prisma.blogPost.create({
      data: {
        slug: a.slug,
        ...data,
        published: true,
        publishedAt: new Date(Date.now() - a.publishedDaysAgo * DAY),
        authorId: admin.id,
      },
    });
    console.log(`«${a.slug}» ساخته شد.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
