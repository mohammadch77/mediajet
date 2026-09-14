// ایجاد صفحات پیش‌فرض (درباره ما، قوانین و مقررات، سؤالات متداول) در صورت نبود.
// اجرا: npx tsx scripts/seed-pages.ts

import { prisma } from "../lib/db";
import { DEFAULT_PAGES } from "../lib/pages";

async function main() {
  for (const def of DEFAULT_PAGES) {
    const existing = await prisma.page.findUnique({ where: { slug: def.slug } });
    if (existing) {
      console.log(`صفحه‌ی «${def.slug}» از قبل وجود دارد؛ رد شد.`);
      continue;
    }
    await prisma.page.create({
      data: {
        slug: def.slug,
        title: def.title,
        contentHtml: def.contentHtml,
        published: true,
        updatedBy: "system",
      },
    });
    console.log(`صفحه‌ی «${def.slug}» ساخته شد.`);
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
